"use client";

import { useEffect, useRef } from "react";
import type WaveSurferType from "wavesurfer.js";

export default function Waveform({
  audioUrl,
  waveColor = "#2E7D6B",
  progressColor = "#1F5A4C",
  height = 72,
  label,
}: {
  audioUrl: string | null;
  waveColor?: string;
  progressColor?: string;
  height?: number;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurferType | null>(null);

  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;
    let disposed = false;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      if (disposed || !containerRef.current) return;
      wsRef.current?.destroy();
      wsRef.current = WaveSurfer.create({
        container: containerRef.current,
        waveColor,
        progressColor,
        height,
        cursorColor: "#C97A2B",
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        url: audioUrl,
      });
    })();

    return () => {
      disposed = true;
      wsRef.current?.destroy();
      wsRef.current = null;
    };
  }, [audioUrl, waveColor, progressColor, height]);

  const play = () => wsRef.current?.playPause();

  if (!audioUrl) return null;

  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        {label && <span className="text-sm font-medium text-mute">{label}</span>}
        <button
          onClick={play}
          className="rounded-full bg-teal-light px-3 py-1 text-xs font-medium text-teal-dark hover:bg-teal/20"
        >
          Play / Pause
        </button>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
