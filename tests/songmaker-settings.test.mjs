import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODEL_VERSION_OPTIONS,
  PROVIDER_OPTIONS,
  countConfiguredApiKeys,
  getProviderConfig,
} from '../src/lib/songmaker-ui.mjs';

test('MODEL_VERSION_OPTIONS matches requested Suno-style selector order', () => {
  assert.deepEqual(MODEL_VERSION_OPTIONS, ['5.5', '5', '4.5+', '4']);
});

test('provider configs expose Modal, SunoAPI.org, and Kie.ai settings', () => {
  assert.deepEqual(
    PROVIDER_OPTIONS.map((provider) => provider.value),
    ['modal', 'sunoapi', 'kie']
  );

  assert.equal(getProviderConfig('modal').label, 'Modal MusicGen');
  assert.equal(getProviderConfig('sunoapi').label, 'SunoAPI.org');
  assert.equal(getProviderConfig('kie').label, 'Kie.ai');
});

test('countConfiguredApiKeys ignores empty lines and whitespace', () => {
  assert.equal(countConfiguredApiKeys('key-1\n\n key-2 \n   '), 2);
});
