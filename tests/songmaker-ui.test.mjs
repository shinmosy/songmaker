import test from 'node:test';
import assert from 'node:assert/strict';

import {
  boostDescription,
  getRecentTracks,
  getStatusMeta,
} from '../src/lib/songmaker-ui.mjs';

test('boostDescription enriches a sparse prompt with mode, type, gender, and tags once', () => {
  const boosted = boostDescription({
    description: 'warm piano melody',
    tags: ['Lo-fi', 'Ambient'],
    mode: 'Advanced',
    type: 'Vocal',
    gender: 'Female',
  });

  assert.match(boosted, /warm piano melody/i);
  assert.match(boosted, /advanced/i);
  assert.match(boosted, /vocal/i);
  assert.match(boosted, /female/i);
  assert.match(boosted, /lo-fi/i);
  assert.match(boosted, /ambient/i);
});

test('getRecentTracks returns newest tracks first and respects the limit', () => {
  const tracks = [
    { id: '1', createdAt: '2026-04-24T10:00:00.000Z' },
    { id: '2', createdAt: '2026-04-24T12:00:00.000Z' },
    { id: '3', createdAt: '2026-04-24T11:00:00.000Z' },
  ];

  assert.deepEqual(
    getRecentTracks(tracks, 2).map((track) => track.id),
    ['2', '3']
  );
});

test('getStatusMeta maps status values to readable labels', () => {
  assert.equal(getStatusMeta('done').label, 'Ready');
  assert.equal(getStatusMeta('generating').label, 'Generating');
  assert.equal(getStatusMeta('error').label, 'Error');
});
