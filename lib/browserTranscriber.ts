import type { TranscriptWord } from "./stutterDetector";

// Loaded lazily so the ~40-100MB model only downloads if the person actually
// turns on AI stutter removal, and only once — the browser caches it after that.
let transcriberPromise: Promise<any> | null = null;

export type ModelProgress = { status: string; progress?: number; file?: string };

const TRANSFORMERS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";

async function getTranscriber(onProgress?: (p: ModelProgress) => void) {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      // Loaded straight from a CDN at runtime (same idea as the ffmpeg core
      // elsewhere in this app) instead of bundled — this package ships
      // separate Node/browser builds and native binaries that bundlers like
      // webpack often resolve incorrectly, so we let the browser's own ESM
      // loader fetch the right one directly.
      const { pipeline } = await import(/* webpackIgnore: true */ TRANSFORMERS_CDN_URL);
      return pipeline("automatic-speech-recognition", "onnx-community/whisper-base", {
        dtype: "q8",
        progress_callback: onProgress,
      });
    })();
  }
  return transcriberPromise;
}

/**
 * Runs Whisper entirely in the browser (WASM, or WebGPU when available) and
 * returns word-level timestamps — the same shape the OpenAI route returns,
 * so the rest of the app doesn't need to know which engine produced it.
 */
export async function transcribeInBrowser(
  audioMono16k: Float32Array,
  onProgress?: (p: ModelProgress) => void
): Promise<TranscriptWord[]> {
  const transcriber = await getTranscriber(onProgress);

  const result = await transcriber(audioMono16k, {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const chunks: { text: string; timestamp: [number, number | null] }[] =
    result.chunks ?? [];

  return chunks
    .filter((c) => c.timestamp && c.timestamp[0] != null)
    .map((c) => ({
      word: c.text.trim(),
      start: c.timestamp[0] as number,
      end: (c.timestamp[1] ?? c.timestamp[0]) as number,
    }));
}
