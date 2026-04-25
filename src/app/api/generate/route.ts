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

    // Mock audio generation for MVP
    // In production, replace with real API (Replicate, RunPod, etc)
    
    // Generate fake WAV file (silent audio)
    const sampleRate = 16000;
    const samples = sampleRate * duration;
    const audioData = new Float32Array(samples);
    
    // Create WAV header
    const wavHeader = createWavHeader(audioData.length, sampleRate);
    const audioBuffer = Buffer.concat([
      wavHeader,
      Buffer.from(audioData.buffer),
    ]);
    
    const audioBase64 = audioBuffer.toString('base64');

    return Response.json({
      success: true,
      audio: audioBase64,
      prompt: prompt,
      duration: duration,
      format: 'wav',
      note: 'Mock generation - connect real API for actual audio',
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

function createWavHeader(samples: number, sampleRate: number): Buffer {
  const channels = 1;
  const bytesPerSample = 2;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * bytesPerSample;

  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  
  // fmt subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits per sample
  
  // data subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  return header;
}
