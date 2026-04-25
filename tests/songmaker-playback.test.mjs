import test from 'node:test';
import assert from 'node:assert/strict';

import { getPlayableAudioUrl } from '../src/lib/songmaker-ui.mjs';

test('getPlayableAudioUrl only returns audio for finished tracks', () => {
  assert.equal(
    getPlayableAudioUrl({ status: 'generating', audioUrl: '/test-audio.mp3' }),
    ''
  );

  assert.equal(
    getPlayableAudioUrl({ status: 'error', audioUrl: '/test-audio.mp3' }),
    ''
  );

  assert.equal(
    getPlayableAudioUrl({ status: 'done', audioUrl: '/test-audio.mp3' }),
    ''
  );

  assert.equal(
    getPlayableAudioUrl({ status: 'done', audioUrl: 'data:audio/wav;base64,abc' }),
    'data:audio/wav;base64,abc'
  );
});
