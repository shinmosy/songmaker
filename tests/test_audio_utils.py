import unittest
import numpy as np

from audio_utils import prepare_audio_for_wav


class PrepareAudioForWavTests(unittest.TestCase):
    def test_transposes_channel_first_audio_to_sample_first(self):
        audio = np.array([[0.0, 0.25, -0.25], [0.5, -0.5, 0.0]], dtype=np.float32)

        prepared = prepare_audio_for_wav(audio)

        self.assertEqual(prepared.dtype, np.int16)
        self.assertEqual(prepared.shape, (3, 2))
        self.assertEqual(prepared[0, 0], 0)
        self.assertEqual(prepared[0, 1], 32767)

    def test_keeps_mono_audio_one_dimensional(self):
        audio = np.array([0.0, 0.5, -0.5], dtype=np.float32)

        prepared = prepare_audio_for_wav(audio)

        self.assertEqual(prepared.dtype, np.int16)
        self.assertEqual(prepared.shape, (3,))


if __name__ == '__main__':
    unittest.main()
