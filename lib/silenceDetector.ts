export type TimeRange = { start: number; end: number };

export type SilenceOptions = {
  /** Below this RMS level (0-1) a window counts as "quiet". Lower = more sensitive. */
  amplitudeThreshold: number;
  /** A quiet stretch shorter than this (ms) is left alone (natural breathing gaps). */
  minSilenceMs: number;
  /** A detected pause is trimmed down to this length (ms) instead of being deleted entirely,
   * so speech doesn't sound unnaturally glued together. */
  keepPaddingMs: number;
};

export const DEFAULT_SILENCE_OPTIONS: SilenceOptions = {
  amplitudeThreshold: 0.02,
  minSilenceMs: 400,
  keepPaddingMs: 120,
};

/**
 * Scans an AudioBuffer in small windows and returns the list of "cut" ranges
 * (the excess silence to remove) in seconds. Everything NOT in this list should
 * be kept, with each qualifying silence shrunk to `keepPaddingMs` rather than
 * removed completely.
 */
export function detectExcessSilence(
  buffer: AudioBuffer,
  options: SilenceOptions = DEFAULT_SILENCE_OPTIONS
): TimeRange[] {
  const { amplitudeThreshold, minSilenceMs, keepPaddingMs } = options;
  const sampleRate = buffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
  const channelData = averageChannels(buffer);

  const quietWindows: boolean[] = [];
  for (let i = 0; i < channelData.length; i += windowSize) {
    const slice = channelData.subarray(i, i + windowSize);
    const rms = computeRms(slice);
    quietWindows.push(rms < amplitudeThreshold);
  }

  const cuts: TimeRange[] = [];
  let runStart: number | null = null;

  for (let i = 0; i < quietWindows.length; i++) {
    if (quietWindows[i]) {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      pushCutIfLongEnough(runStart, i);
      runStart = null;
    }
  }
  if (runStart !== null) pushCutIfLongEnough(runStart, quietWindows.length);

  function pushCutIfLongEnough(startWindow: number, endWindow: number) {
    const startSec = (startWindow * windowSize) / sampleRate;
    const endSec = (endWindow * windowSize) / sampleRate;
    const durationMs = (endSec - startSec) * 1000;
    if (durationMs < minSilenceMs) return;

    // Shrink the silence: keep `keepPaddingMs/2` on each edge, cut the middle.
    const padSec = keepPaddingMs / 2 / 1000;
    const cutStart = startSec + padSec;
    const cutEnd = endSec - padSec;
    if (cutEnd > cutStart) {
      cuts.push({ start: cutStart, end: cutEnd });
    }
  }

  return cuts;
}

function averageChannels(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

function computeRms(slice: Float32Array): number {
  if (slice.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < slice.length; i++) sum += slice[i] * slice[i];
  return Math.sqrt(sum / slice.length);
}
