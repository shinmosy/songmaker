import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMusicGenerationPayload,
  extractProviderAudioUrl,
  extractProviderTaskId,
  mapUiModelToProviderModel,
  resolveProviderTarget,
} from '../src/lib/songmaker-provider.mjs';

test('mapUiModelToProviderModel converts UI versions to Suno-compatible versions', () => {
  assert.equal(mapUiModelToProviderModel('5.5'), 'V5_5');
  assert.equal(mapUiModelToProviderModel('5'), 'V5');
  assert.equal(mapUiModelToProviderModel('4.5+'), 'V4_5PLUS');
  assert.equal(mapUiModelToProviderModel('4'), 'V4');
  assert.equal(mapUiModelToProviderModel('unknown'), 'V5_5');
});

test('resolveProviderTarget falls back to modal when provider key is missing', () => {
  assert.deepEqual(
    resolveProviderTarget({ provider: 'sunoapi', apiKey: '' }),
    { provider: 'modal', apiKey: '', reason: 'missing_api_key' }
  );

  assert.deepEqual(
    resolveProviderTarget({ provider: 'kie', apiKey: 'kie-live-key' }),
    { provider: 'kie', apiKey: 'kie-live-key', reason: 'provider_api_key' }
  );
});

test('buildMusicGenerationPayload uses custom mode for instrumental provider-backed generation', () => {
  assert.deepEqual(
    buildMusicGenerationPayload({
      title: 'Neon Drive',
      description: 'upbeat synthwave night drive',
      lyrics: '',
      tags: ['Electronic', 'Pop'],
      type: 'Instrumental',
      model: '5.5',
      callBackUrl: 'https://app.example.com/api/provider-callback/songmaker',
    }),
    {
      customMode: true,
      instrumental: true,
      model: 'V5_5',
      title: 'Neon Drive',
      style: 'upbeat synthwave night drive Tags: Electronic, Pop',
      callBackUrl: 'https://app.example.com/api/provider-callback/songmaker',
    }
  );
});

test('buildMusicGenerationPayload uses custom mode for vocal generation and keeps lyrics in prompt', () => {
  assert.deepEqual(
    buildMusicGenerationPayload({
      title: 'Midnight Echo',
      description: 'moody pop ballad',
      lyrics: 'Hold me close through the city lights',
      tags: ['Pop'],
      type: 'Vocal',
      model: '5',
      callBackUrl: 'https://app.example.com/api/provider-callback/songmaker',
    }),
    {
      customMode: true,
      instrumental: false,
      model: 'V5',
      title: 'Midnight Echo',
      style: 'moody pop ballad Tags: Pop',
      prompt: 'Hold me close through the city lights',
      callBackUrl: 'https://app.example.com/api/provider-callback/songmaker',
    }
  );
});

test('extractProviderTaskId supports common provider response shapes', () => {
  assert.equal(extractProviderTaskId({ code: 200, data: { taskId: 'task-123' } }), 'task-123');
  assert.equal(extractProviderTaskId({ taskId: 'task-456' }), 'task-456');
  assert.equal(extractProviderTaskId({ data: { data: { taskId: 'task-789' } } }), 'task-789');
});

test('extractProviderAudioUrl prefers downloadable audio and falls back to streaming audio', () => {
  const direct = extractProviderAudioUrl({
    data: {
      response: {
        sunoData: [{ audioUrl: 'https://cdn.example.com/song.mp3', streamAudioUrl: 'https://cdn.example.com/stream' }],
      },
    },
  });
  assert.equal(direct, 'https://cdn.example.com/song.mp3');

  const streamOnly = extractProviderAudioUrl({
    data: {
      response: {
        clips: [{ stream_audio_url: 'https://cdn.example.com/stream-only' }],
      },
    },
  });
  assert.equal(streamOnly, 'https://cdn.example.com/stream-only');
});
