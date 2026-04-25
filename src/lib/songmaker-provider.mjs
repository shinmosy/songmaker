const MODEL_VERSION_MAP = {
  '5.5': 'V5_5',
  '5': 'V5',
  '4.5+': 'V4_5PLUS',
  '4': 'V4',
};

const AUDIO_URL_KEYS = [
  'audio_url',
  'audioUrl',
  'source_audio_url',
  'sourceAudioUrl',
  'stream_audio_url',
  'streamAudioUrl',
  'source_stream_audio_url',
  'sourceStreamAudioUrl',
];

const SUCCESS_STATUSES = new Set(['SUCCESS', 'FIRST_SUCCESS', 'TEXT_SUCCESS', 'complete', 'first', 'success']);
const FAILURE_STATUSES = new Set([
  'CREATE_TASK_FAILED',
  'GENERATE_AUDIO_FAILED',
  'CALLBACK_EXCEPTION',
  'SENSITIVE_WORD_ERROR',
  'failed',
  'error',
]);

export function mapUiModelToProviderModel(model = '') {
  return MODEL_VERSION_MAP[model] || 'V5_5';
}

export function resolveProviderTarget({ provider = 'modal', apiKey = '' } = {}) {
  const cleanedApiKey = apiKey.trim();

  if (provider === 'modal') {
    return { provider: 'modal', apiKey: '', reason: 'modal_selected' };
  }

  if (!cleanedApiKey) {
    return { provider: 'modal', apiKey: '', reason: 'missing_api_key' };
  }

  return { provider, apiKey: cleanedApiKey, reason: 'provider_api_key' };
}

function compactText(parts = []) {
  return parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimToLength(value = '', maxLength = 0) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}

/**
 * @param {{
 *   title?: string,
 *   description?: string,
 *   lyrics?: string,
 *   tags?: string[],
 *   type?: 'Instrumental' | 'Vocal',
 *   model?: string,
 *   callBackUrl?: string,
 * }} params
 */
export function buildMusicGenerationPayload({
  title = '',
  description = '',
  lyrics = '',
  tags = [],
  type = 'Instrumental',
  model = '5.5',
  callBackUrl = '',
} = {}) {
  const normalizedTags = Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [];
  const style = trimToLength(
    compactText([
      description,
      normalizedTags.length ? `Tags: ${normalizedTags.join(', ')}` : '',
    ]),
    1000
  );
  const normalizedTitle = trimToLength(title, 80) || 'Untitled Song';
  const isInstrumental = type === 'Instrumental';

  if (isInstrumental) {
    return {
      customMode: true,
      instrumental: true,
      model: mapUiModelToProviderModel(model),
      title: normalizedTitle,
      style: style || 'Instrumental soundtrack',
      callBackUrl,
    };
  }

  return {
    customMode: true,
    instrumental: false,
    model: mapUiModelToProviderModel(model),
    title: normalizedTitle,
    style: style || 'Original vocal song',
    prompt: trimToLength(lyrics || description || title, 5000),
    callBackUrl,
  };
}

function deepFindFirst(obj, predicate, seen = new Set()) {
  if (obj == null) return undefined;

  if (typeof obj === 'string') {
    return predicate(obj) ? obj : undefined;
  }

  if (typeof obj !== 'object') return undefined;
  if (seen.has(obj)) return undefined;
  seen.add(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepFindFirst(item, predicate, seen);
      if (found) return found;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && predicate(value, key)) {
      return value;
    }
  }

  for (const value of Object.values(obj)) {
    const found = deepFindFirst(value, predicate, seen);
    if (found) return found;
  }

  return undefined;
}

export function extractProviderTaskId(payload = {}) {
  return deepFindFirst(payload, (value, key) => {
    if (!/taskid/i.test(key || '')) return false;
    return /^[a-zA-Z0-9_-]{4,}$/.test(value);
  }) || '';
}

export function extractProviderAudioUrl(payload = {}) {
  const preferred = deepFindFirst(payload, (value, key) => {
    if (!AUDIO_URL_KEYS.includes(key)) return false;
    return /^https?:\/\//i.test(value) && /\.(mp3|wav|m4a)(\?|$)/i.test(value);
  });

  if (preferred) return preferred;

  return (
    deepFindFirst(payload, (value, key) => {
      if (!AUDIO_URL_KEYS.includes(key)) return false;
      return /^https?:\/\//i.test(value);
    }) || ''
  );
}

export function extractProviderStatus(payload = {}) {
  const status =
    deepFindFirst(payload, (value, key) => /status|callbacktype|state/i.test(key || '') && typeof value === 'string') || '';
  return String(status).trim();
}

export function isProviderTaskComplete(status = '') {
  return SUCCESS_STATUSES.has(String(status).trim());
}

export function isProviderTaskFailed(status = '') {
  return FAILURE_STATUSES.has(String(status).trim());
}

export function getProviderBaseUrl(provider = 'modal') {
  if (provider === 'sunoapi') return 'https://api.sunoapi.org';
  if (provider === 'kie') return 'https://api.kie.ai';
  return '';
}

export function getProviderLabel(provider = 'modal') {
  if (provider === 'sunoapi') return 'SunoAPI.org';
  if (provider === 'kie') return 'Kie.ai';
  return 'Modal MusicGen';
}
