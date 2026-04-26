"use client";

import { useEffect, useRef } from "react";

interface WaveformPreviewProps {
  audioUrl?: string;
  isPlaying?: boolean;
}

export function WaveformPreview({ audioUrl, isPlaying }: WaveformPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Initialize audio context
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    const audioContext = audioContextRef.current;

    // Create analyser
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Draw waveform
    const draw = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);

      // Draw bars
      const barWidth = (canvas.offsetWidth / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.offsetHeight;

        // Gradient color
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`;
        ctx.fillRect(x, canvas.offsetHeight - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      if (isPlaying) {
        animationIdRef.current = requestAnimationFrame(draw);
      }
    };

    if (isPlaying) {
      draw();
    } else {
      // Draw static waveform
      ctx.fillStyle = "#e0e0e0";
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.random() * (canvas.offsetHeight * 0.6);
        const barWidth = (canvas.offsetWidth / bufferLength) * 2.5;
        const x = (i / bufferLength) * canvas.offsetWidth;
        ctx.fillRect(x, canvas.offsetHeight - barHeight, barWidth, barHeight);
      }
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [audioUrl, isPlaying]);

  return (
    <div className="waveform-container">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}
