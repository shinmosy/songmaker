import type { NextRequest } from 'next/server';

import {
  buildMusicGenerationPayload,
  extractProviderTaskId,
  getProviderBaseUrl,
  getProviderLabel,
  resolveProviderTarget,
} from '../../../lib/songmaker-provider.mjs';

const MODAL_ENDPOINT = 'https://shinmosy--songmaker-inference-generate-endpoint.modal.run';

type GenerateBody = {
  prompt?: string;
  duration?: number;
  title?: string;
  description?: string;
  lyrics?: string;
  model?: string;
  type?: 'Instrumental' | 'Vocal';
  tags?: string[];
  provider?: 'modal' | 'sunoapi' | 'kie';
  apiKeys?: string;
};

function pickApiKey(rawValue = '') {
  return rawValue
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || '';
}

function getEnvProviderKey(provider: string) {
  if (provider === 'sunoapi') {
    return process.env.SUNOAPI_KEY || process.env.SUNO_API_KEY || '';
  }

  if (provider === 'kie') {
    return process.env.KIE_API_KEY || process.env.KIEAI_API_KEY || '';
  }

  return '';
}

function getCallbackUrl(request: NextRequest) {
  return `${request.nextUrl.origin}/api/provider-callback/songmaker`;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function callModal(body: GenerateBody) {
  const modalResponse = await fetch(MODAL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: body.prompt,
      duration: body.duration ?? 10,
    }),
  });

  const result = await parseJsonSafe(modalResponse);

  if (!modalResponse.ok) {
    throw new Error(`Modal API error: ${modalResponse.status}`);
  }

  if (!result.success || !result.audio) {
    throw new Error(result.error || 'Modal generation failed');
  }

  return {
    success: true,
    audio: result.audio,
    format: result.format || 'wav',
    providerUsed: 'modal',
    note: 'Generated with Modal MusicGen',
  };
}

async function createSunoCompatibleTask(request: NextRequest, body: GenerateBody, provider: 'sunoapi' | 'kie', apiKey: string) {
  const baseUrl = getProviderBaseUrl(provider);
  const providerLabel = getProviderLabel(provider);
  const payload = buildMusicGenerationPayload({
    title: body.title,
    description: body.description || body.prompt,
    lyrics: body.lyrics,
    tags: body.tags,
    type: body.type,
    model: body.model,
    callBackUrl: getCallbackUrl(request),
  });

  const generateResponse = await fetch(`${baseUrl}/api/v1/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const generateResult = await parseJsonSafe(generateResponse);
  const message = generateResult.msg || generateResult.message || generateResult.error || '';

  if (!generateResponse.ok || (typeof generateResult.code === 'number' && generateResult.code !== 200)) {
    throw new Error(`${providerLabel}: ${message || `Generate request failed (${generateResponse.status})`}`);
  }

  const taskId = extractProviderTaskId(generateResult);
  if (!taskId) {
    throw new Error(`${providerLabel}: taskId tidak ditemukan dari response generate`);
  }

  return {
    success: true,
    queued: true,
    taskId,
    providerUsed: provider,
    note: `${providerLabel}: task dibuat, sedang diproses...`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    const prompt = body.prompt?.trim() || body.description?.trim();

    if (!prompt) {
      return Response.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    const requestedProvider = body.provider || 'modal';
    const selectedApiKey = pickApiKey(body.apiKeys || '') || getEnvProviderKey(requestedProvider);
    const providerTarget = resolveProviderTarget({ provider: requestedProvider, apiKey: selectedApiKey });

    if (providerTarget.provider === 'modal') {
      const modalResult = await callModal({ ...body, prompt });
      const note =
        requestedProvider !== 'modal' && providerTarget.reason === 'missing_api_key'
          ? `${modalResult.note} (fallback karena API key ${getProviderLabel(requestedProvider)} belum ada)`
          : modalResult.note;

      return Response.json({ ...modalResult, note });
    }

    const result = await createSunoCompatibleTask(
      request,
      { ...body, prompt },
      providerTarget.provider as 'sunoapi' | 'kie',
      providerTarget.apiKey
    );

    return Response.json(result, { status: 202 });
  } catch (error) {
    console.error('Generate error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = /permission|unauthorized|access/i.test(message)
      ? 401
      : /required|invalid|limit|taskId|failed/i.test(message)
        ? 400
        : 500;

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
