import base64
import io

import modal
import numpy as np
import scipy.io.wavfile as wavfile
import torch
from transformers import AutoProcessor, MusicgenForConditionalGeneration

MODEL_ID = "facebook/musicgen-small"
app = modal.App("songmaker-inference")


def download_model():
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_ID)


image = (
    modal.Image.debian_slim()
    .pip_install(
        "torch",
        "torchaudio",
        "transformers",
        "scipy",
        "numpy",
        "fastapi",
        "huggingface_hub",
    )
    .run_function(download_model)
)

processor = None
model = None
sample_rate = 32000


def prepare_audio_for_wav(audio_values) -> np.ndarray:
    audio_np = np.asarray(audio_values, dtype=np.float32)

    if audio_np.ndim == 0:
        raise ValueError("audio array is empty")

    if audio_np.ndim == 2:
        if audio_np.shape[0] == 1:
            audio_np = audio_np[0]
        elif audio_np.shape[0] <= 8 and audio_np.shape[0] < audio_np.shape[1]:
            audio_np = audio_np.T

    max_val = float(np.max(np.abs(audio_np))) if audio_np.size else 0.0
    if max_val > 0:
        audio_np = audio_np / max_val

    audio_np = np.clip(audio_np, -1.0, 1.0)
    return np.int16(audio_np * 32767)


def load_pipeline():
    global processor, model, sample_rate

    if processor is None or model is None:
        processor = AutoProcessor.from_pretrained(MODEL_ID, local_files_only=True)
        model = MusicgenForConditionalGeneration.from_pretrained(MODEL_ID, local_files_only=True)
        model = model.to("cuda")
        model.eval()
        sample_rate = getattr(getattr(model.config, "audio_encoder", None), "sampling_rate", 32000)

    return processor, model, sample_rate


@app.function(image=image, gpu="T4", timeout=600, scaledown_window=300)
@modal.fastapi_endpoint(method="POST")
def generate_endpoint(data: dict) -> dict:
    """Web endpoint for music generation."""
    prompt = data.get("prompt", "")
    duration = int(data.get("duration", 10))

    if not prompt:
        return {"success": False, "error": "Prompt is required"}

    try:
        processor, model, sample_rate = load_pipeline()

        inputs = processor(
            text=[prompt],
            padding=True,
            return_tensors="pt",
        )
        inputs = {key: value.to("cuda") for key, value in inputs.items()}

        max_new_tokens = min(max(duration, 1) * 50, 1024)

        with torch.inference_mode():
            audio_values = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                guidance_scale=3.0,
            )

        audio_int16 = prepare_audio_for_wav(audio_values[0].cpu().numpy())

        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, audio_int16)
        wav_buffer.seek(0)

        audio_base64 = base64.b64encode(wav_buffer.read()).decode("utf-8")

        return {
            "success": True,
            "audio": audio_base64,
            "format": "wav",
            "sample_rate": sample_rate,
            "duration": duration,
            "prompt": prompt,
        }
    except Exception as error:
        return {
            "success": False,
            "error": str(error),
            "prompt": prompt,
        }
