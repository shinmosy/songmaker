import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPlayableQueue,
  getNextTrackId,
  getPreviousTrackId,
  getLyricsLines,
  getAlbumThumbnailMeta,
} from '../src/lib/songmaker-player.mjs';

const tracks = [
  { id: 'a', title: 'Alpha Echo', status: 'done', audioUrl: 'data:audio/wav;base64,a', lyrics: 'line 1\nline 2', tags: ['Pop'] },
  { id: 'b', title: 'Beta Night', status: 'error', audioUrl: 'data:audio/wav;base64,b', lyrics: '', tags: ['Jazz'] },
  { id: 'c', title: 'City Lights', status: 'done', audioUrl: 'https://cdn.example.com/c.mp3', lyrics: ' verse 1 \n\n verse 2 ', tags: ['Electronic'] },
];

test('getPlayableQueue only keeps ready tracks with valid audio', () => {
  assert.deepEqual(
    getPlayableQueue(tracks).map((track) => track.id),
    ['a', 'c']
  );
});

test('getNextTrackId moves to the next track and wraps when repeat-all is enabled', () => {
  const queue = getPlayableQueue(tracks);

  assert.equal(getNextTrackId({ queue, currentTrackId: 'a', shuffle: false, repeatMode: 'off' }), 'c');
  assert.equal(getNextTrackId({ queue, currentTrackId: 'c', shuffle: false, repeatMode: 'all' }), 'a');
  assert.equal(getNextTrackId({ queue, currentTrackId: 'c', shuffle: false, repeatMode: 'one' }), 'c');
  assert.equal(getNextTrackId({ queue, currentTrackId: 'c', shuffle: false, repeatMode: 'off' }), null);
});

test('getPreviousTrackId returns the previous playable track and wraps to the end', () => {
  const queue = getPlayableQueue(tracks);

  assert.equal(getPreviousTrackId({ queue, currentTrackId: 'c' }), 'a');
  assert.equal(getPreviousTrackId({ queue, currentTrackId: 'a' }), 'c');
});

test('getLyricsLines trims empty lines and returns clean lyric rows', () => {
  assert.deepEqual(getLyricsLines(tracks[0].lyrics), ['line 1', 'line 2']);
  assert.deepEqual(getLyricsLines(tracks[2].lyrics), ['verse 1', 'verse 2']);
  assert.deepEqual(getLyricsLines('   '), []);
});

test('getAlbumThumbnailMeta builds deterministic seeded thumbnail artwork', () => {
  const alpha = getAlbumThumbnailMeta(tracks[0]);
  const alphaAgain = getAlbumThumbnailMeta(tracks[0]);
  const midnight = getAlbumThumbnailMeta({ title: 'midnight' });

  assert.equal(alpha.initials, 'AE');
  assert.equal(midnight.initials, 'M');
  assert.match(alpha.accentClassName, /^from-(zinc|white)/);
  assert.match(midnight.accentClassName, /^from-(zinc|white)/);
  assert.match(alpha.artworkDataUrl, /^data:image\/svg\+xml/);
  assert.equal(alpha.artworkDataUrl, alphaAgain.artworkDataUrl);
  assert.notEqual(alpha.artworkDataUrl, midnight.artworkDataUrl);
});
