/**
 * @typedef {'Simple' | 'Advanced' | 'Sounds'} Mode
 * @typedef {'Instrumental' | 'Vocal'} TrackType
 * @typedef {'Male' | 'Female'} VocalGender
 * @typedef {'mock' | 'queued' | 'generating' | 'done' | 'error'} TrackStatus
 */

export const MODEL_VERSION_OPTIONS = ['5.5', '5', '4.5+', '4'];

export const PROVIDER_OPTIONS = [
  {
    value: 'modal',
    label: 'Modal MusicGen',
    baseUrl: 'https://shinmosy--songmaker-inference-generate-endpoint.modal.run',
    creditPath: 'n/a',
    notes: 'Fallback internal yang langsung ngasih audio real tanpa API key tambahan.',
  },
  {
    value: 'sunoapi',
    label: 'SunoAPI.org',
    baseUrl: 'https://api.sunoapi.org',
    creditPath: '/api/v1/get-credits',
    notes: 'Provider Suno-compatible. Butuh API key aktif untuk generate real.',
  },
  {
    value: 'kie',
    label: 'Kie.ai',
    baseUrl: 'https://api.kie.ai',
    creditPath: '/api/v1/account/credit',
    notes: 'Provider Suno-compatible alternatif. Butuh API key aktif untuk generate real.',
  },
];

/** @type {Record<TrackStatus, { label: string; tone: string }>} */
const STATUS_META = {
  mock: {
    label: 'Mock',
    tone: 'border-gray-600 bg-gray-800 text-gray-300',
  },
  queued: {
    label: 'Queued',
    tone: 'border-yellow-700 bg-yellow-950 text-yellow-300',
  },
  generating: {
    label: 'Generating',
    tone: 'border-blue-700 bg-blue-950 text-blue-300',
  },
  done: {
    label: 'Ready',
    tone: 'border-green-700 bg-green-950 text-green-300',
  },
  error: {
    label: 'Error',
    tone: 'border-red-700 bg-red-950 text-red-300',
  },
};

/**
 * @param {{
 *   description?: string,
 *   tags?: string[],
 *   mode?: Mode,
 *   type?: TrackType,
 *   gender?: VocalGender,
 * }} params
 */
export function boostDescription({
  description = '',
  tags = [],
  mode = 'Simple',
  type = 'Instrumental',
  gender = 'Male',
}) {
  const cleanedDescription = description.trim();
  const parts = [cleanedDescription || 'cinematic original composition'];
  const normalizedText = cleanedDescription.toLowerCase();

  /** @param {string} fragment @param {string[]} keywords */
  const maybeAdd = (fragment, keywords = []) => {
    const alreadyPresent = keywords.some((keyword) => normalizedText.includes(keyword));
    if (!alreadyPresent) {
      parts.push(fragment);
    }
  };

  maybeAdd(`${mode.toLowerCase()} arrangement`, [mode.toLowerCase()]);
  maybeAdd(type.toLowerCase(), ['instrumental', 'vocal']);

  if (type === 'Vocal') {
    maybeAdd(`${gender.toLowerCase()} vocal`, [gender.toLowerCase()]);
  }

  if (tags.length > 0) {
    const missingTags = tags.filter((tag) => !normalizedText.includes(tag.toLowerCase()));
    if (missingTags.length > 0) {
      parts.push(missingTags.join(', '));
    }
  }

  return parts.join(', ');
}

/**
 * @template T
 * @param {(T & { createdAt: string })[]} tracks
 * @param {number} [limit=5]
 */
export function getRecentTracks(tracks = [], limit = 5) {
  return [...tracks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** @param {TrackStatus} status */
export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.mock;
}

/**
 * @param {{ status?: TrackStatus, audioUrl?: string }} track
 */
export function getPlayableAudioUrl(track) {
  if (!track || track.status !== 'done') {
    return '';
  }

  const url = track.audioUrl?.trim() || '';
  if (!url || url === '/test-audio.mp3') {
    return '';
  }

  return url;
}

export function getProviderConfig(provider) {
  return PROVIDER_OPTIONS.find((item) => item.value === provider) || PROVIDER_OPTIONS[0];
}

export function countConfiguredApiKeys(value = '') {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}
