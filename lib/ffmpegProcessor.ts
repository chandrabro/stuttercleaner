import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { TimeRange } from "./silenceDetector";

const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

let ffmpegSingleton: FFmpeg | null = null;

async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  const ffmpeg = new FFmpeg();
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegSingleton = ffmpeg;
  return ffmpeg;
}

export type ProcessProgress = (fraction: number) => void;

/**
 * Cuts the input file down to only the given `keepRanges` (in seconds, sorted, non-overlapping)
 * and returns a single stitched-together WAV file as a Blob.
 */
export async function renderCleanedAudio(
  file: File,
  keepRanges: TimeRange[],
  onProgress?: ProcessProgress
): Promise<Blob> {
  if (keepRanges.length === 0) {
    throw new Error("Nothing left to keep — the detected cuts remove the entire recording.");
  }

  const ffmpeg = await getFFmpeg();
  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))));
  }

  const inputName = "input" + extOf(file.name);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Build a filter_complex graph: trim each keep segment, then concat them all.
  const trimLabels: string[] = [];
  const filterParts: string[] = keepRanges.map((range, i) => {
    const label = `a${i}`;
    trimLabels.push(`[${label}]`);
    return `[0:a]atrim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(
      3
    )},asetpts=PTS-STARTPTS[${label}]`;
  });
  const filterComplex =
    filterParts.join(";") +
    `;${trimLabels.join("")}concat=n=${keepRanges.length}:v=0:a=1[outa]`;

  const outputName = "output.wav";
  await ffmpeg.exec([
    "-i",
    inputName,
    "-filter_complex",
    filterComplex,
    "-map",
    "[outa]",
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  const bytes = new Uint8Array(data as Uint8Array);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}

function extOf(filename: string): string {
  const match = filename.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0] : ".dat";
}
