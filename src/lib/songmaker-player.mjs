import { getPlayableAudioUrl } from './songmaker-ui.mjs';

/**
 * @typedef {{
 *   id?: string,
 *   title?: string,
 *   status?: string,
 *   audioUrl?: string,
 *   lyrics?: string,
 *   tags?: string[],
 *   model?: string,
 *   type?: string,
 * }} PlayerTrack
 */

const THUMBNAIL_ACCENTS = [
  'from-zinc-100 via-zinc-400 to-zinc-800',
  'from-zinc-200 via-zinc-500 to-black',
  'from-white via-zinc-300 to-zinc-700',
  'from-zinc-50 via-zinc-500 to-zinc-900',
];

function buildSeed(value = '') {
  return Array.from(String(value)).reduce((total, char, index) => total + char.charCodeAt(0) * (index + 11), 0);
}

function pickFromSeed(seed, options = []) {
  if (options.length === 0) return '';
  return options[Math.abs(seed) % options.length];
}

function buildThumbnailArtworkDataUrl(seed, initials) {
  const base = 30 + (seed % 40);
  const secondary = 20 + ((seed * 3) % 50);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="50%" stop-color="#9ca3af" />
          <stop offset="100%" stop-color="#111111" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="40" fill="url(#bg)" />
      <circle cx="${50 + (seed % 120)}" cy="${55 + (seed % 60)}" r="${base}" fill="#111111" fill-opacity="0.16" />
      <circle cx="${180 - (seed % 70)}" cy="${160 - (seed % 45)}" r="${secondary}" fill="#ffffff" fill-opacity="0.18" />
      <path d="M30 ${170 - (seed % 40)} C80 ${110 + (seed % 30)}, 140 ${220 - (seed % 50)}, 220 ${120 + (seed % 35)}" stroke="#ffffff" stroke-opacity="0.24" stroke-width="18" stroke-linecap="round" />
      <rect x="28" y="28" width="184" height="184" rx="32" stroke="#ffffff" stroke-opacity="0.18" />
      <text x="36" y="205" font-family="Arial, sans-serif" font-size="52" font-weight="700" letter-spacing="10" fill="#111111" fill-opacity="0.74">${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** @param {PlayerTrack[]} tracks */
export function getPlayableQueue(tracks = []) {
  return tracks.filter((track) => getPlayableAudioUrl(track));
}

/** @param {PlayerTrack[]} queue @param {string} currentTrackId */
export function getQueueIndex(queue = [], currentTrackId = '') {
  return queue.findIndex((track) => track.id === currentTrackId);
}

/** @param {{ queue?: PlayerTrack[], currentTrackId?: string, shuffle?: boolean, repeatMode?: 'off' | 'all' | 'one' }} params */
export function getNextTrackId({ queue = [], currentTrackId = '', shuffle = false, repeatMode = 'off' } = {}) {
  if (queue.length === 0) return null;

  const currentIndex = getQueueIndex(queue, currentTrackId);
  if (currentIndex === -1) return queue[0]?.id || null;

  if (repeatMode === 'one') {
    return queue[currentIndex]?.id || null;
  }

  if (shuffle && queue.length > 1) {
    return queue[(currentIndex + 1) % queue.length]?.id || null;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex < queue.length) {
    return queue[nextIndex]?.id || null;
  }

  if (repeatMode === 'all') {
    return queue[0]?.id || null;
  }

  return null;
}

/** @param {{ queue?: PlayerTrack[], currentTrackId?: string }} params */
export function getPreviousTrackId({ queue = [], currentTrackId = '' } = {}) {
  if (queue.length === 0) return null;

  const currentIndex = getQueueIndex(queue, currentTrackId);
  if (currentIndex === -1 || currentIndex === 0) {
    return queue[queue.length - 1]?.id || null;
  }

  return queue[currentIndex - 1]?.id || null;
}

/** @param {string} lyrics */
export function getLyricsLines(lyrics = '') {
  return String(lyrics)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** @param {PlayerTrack} track */
export function getAlbumThumbnailMeta(track = {}) {
  const words = String(track.title || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const initials = words.length > 1
    ? `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
    : (words[0]?.slice(0, 1).toUpperCase() || 'SM');

  const seed = buildSeed(`${track.title || ''}|${(track.tags || []).join(',')}|${track.model || ''}|${track.type || ''}`);
  const accentClassName = pickFromSeed(seed, THUMBNAIL_ACCENTS);

  return {
    initials,
    accentClassName,
    artworkDataUrl: buildThumbnailArtworkDataUrl(seed, initials),
  };
}
