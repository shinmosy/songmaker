import modal
import io
import json
import base64

app = modal.App("songmaker-inference")

# Minimal setup
image = (
    modal.Image.debian_slim()
    .pip_install("torch", "torchaudio", "transformers", "scipy")
)

@app.function(image=image, gpu="T4", timeout=600)
def generate_music(prompt: str, duration: int = 10) -> dict:
    """Generate music using Hugging Face model"""
    try:
        from transformers import pipeline
        import torch
        
        # Use a simpler text-to-audio model
        pipe = pipeline("text-to-audio", model="facebook/musicgen-small", device=0)
        
        # Generate
        audio = pipe(prompt, forward_params={"do_sample": True, "max_length": int(duration * 16000)})
        
        # Convert to base64
        import numpy as np
        audio_data = audio["audio"]
        
        # Normalize and convert to int16
        audio_int16 = np.int16(audio_data / np.max(np.abs(audio_data)) * 32767)
        
        # Save to bytes
        buffer = io.BytesIO()
        import scipy.io.wavfile as wavfile
        wavfile.write(buffer, audio["sampling_rate"], audio_int16)
        audio_bytes = buffer.getvalue()
        
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return {
            "success": True,
            "audio": audio_b64,
            "prompt": prompt,
            "duration": duration,
            "format": "wav"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.local_entrypoint()
def test():
    """Test function"""
    result = generate_music.remote("upbeat electronic dance music", duration=5)
    print(json.dumps({k: v if k != "audio" else f"{v[:50]}..." for k, v in result.items()}, indent=2))
