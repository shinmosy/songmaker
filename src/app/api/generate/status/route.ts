import type { NextRequest } from 'next/server';

import {
  extractProviderAudioUrl,
  extractProviderStatus,
  getProviderBaseUrl,
  getProviderLabel,
  isProviderTaskComplete,
  isProviderTaskFailed,
  resolveProviderTarget,
} from '../../../../lib/songmaker-provider.mjs';

type StatusBody = {
  provider?: 'modal' | 'sunoapi' | 'kie';
  apiKeys?: string;
  taskId?: string;
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

async function parseJsonSafe(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StatusBody;
    const requestedProvider = body.provider || 'modal';
    const taskId = body.taskId?.trim();

    if (!taskId) {
      return Response.json({ success: false, error: 'taskId wajib ada' }, { status: 400 });
    }

    const selectedApiKey = pickApiKey(body.apiKeys || '') || getEnvProviderKey(requestedProvider);
    const providerTarget = resolveProviderTarget({ provider: requestedProvider, apiKey: selectedApiKey });

    if (providerTarget.provider === 'modal') {
      return Response.json({ success: false, error: 'Status polling hanya untuk SunoAPI/Kie' }, { status: 400 });
    }

    const provider = providerTarget.provider as 'sunoapi' | 'kie';
    const providerLabel = getProviderLabel(provider);
    const detailResponse = await fetch(
      `${getProviderBaseUrl(provider)}/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${providerTarget.apiKey}`,
        },
        cache: 'no-store',
      }
    );

    const detailResult = await parseJsonSafe(detailResponse);
    const message = detailResult.msg || detailResult.message || detailResult.error || '';

    if (!detailResponse.ok || (typeof detailResult.code === 'number' && detailResult.code !== 200)) {
      return Response.json(
        {
          success: false,
          error: `${providerLabel}: ${message || `Detail request failed (${detailResponse.status})`}`,
        },
        { status: detailResponse.ok ? 400 : detailResponse.status }
      );
    }

    const audioUrl = extractProviderAudioUrl(detailResult);
    if (audioUrl) {
      return Response.json({
        success: true,
        ready: true,
        audioUrl,
        taskId,
        providerUsed: provider,
        note: `Generated with ${providerLabel}`,
      });
    }

    const status = extractProviderStatus(detailResult);
    if (isProviderTaskFailed(status)) {
      return Response.json(
        {
          success: false,
          error: `${providerLabel}: task gagal (${status})`,
        },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      ready: isProviderTaskComplete(status),
      queued: !isProviderTaskComplete(status),
      taskId,
      status,
      providerUsed: provider,
      note: `${providerLabel}: status ${status || 'PENDING'}`,
    });
  } catch (error) {
    console.error('Generate status error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
