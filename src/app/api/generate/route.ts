import type { NextRequest } from 'next/server';

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

    const hfToken = process.env.HUGGINGFACE_API_KEY;
    if (!hfToken) {
      return Response.json(
        { success: false, error: 'HuggingFace API key not configured' },
        { status: 500 }
      );
    }

    // Call HuggingFace Inference API
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/facebook/musicgen-medium',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_length: Math.min(duration * 50, 1500), // HF uses tokens, ~50 tokens per second
          },
        }),
      }
    );

    if (!hfResponse.ok) {
      const error = await hfResponse.text();
      console.error('HF API error:', error);
      return Response.json(
        { success: false, error: `HuggingFace API error: ${hfResponse.status}` },
        { status: hfResponse.status }
      );
    }

    // HF returns binary audio (WAV)
    const audioBuffer = await hfResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return Response.json({
      success: true,
      audio: audioBase64,
      prompt: prompt,
      duration: duration,
      format: 'wav',
      note: 'Generated with HuggingFace MusicGen',
    });
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
