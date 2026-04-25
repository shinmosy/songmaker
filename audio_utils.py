import numpy as np


def prepare_audio_for_wav(audio_values) -> np.ndarray:
    """Convert MusicGen output into a WAV-safe int16 numpy array."""
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
