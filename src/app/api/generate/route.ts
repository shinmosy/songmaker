import type { NextRequest } from 'next/server';

const MODAL_ENDPOINT = 'https://shinmosy--songmaker-inference-generate-music.modal.run';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, duration = 10 } = body;

    if (!prompt) {
      return Response.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Call Modal endpoint
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, duration }),
    });

    if (!response.ok) {
      throw new Error(`Modal API error: ${response.status}`);
    }

    const result = await response.json();
    return Response.json(result);
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
