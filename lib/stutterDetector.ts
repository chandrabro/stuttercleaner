import type { TimeRange } from "./silenceDetector";

export type TranscriptWord = {
  word: string;
  start: number; // seconds
  end: number; // seconds
};

export type StutterOptions = {
  /** Remove immediate word repeats, e.g. "I I I want" -> "I want" */
  removeRepeatedWords: boolean;
  /** Remove common filler words entirely, e.g. "um", "uh" */
  removeFillerWords: boolean;
  /** Also collapse repeated leading sounds within a word boundary is not attempted here;
   * this operates at the whole-word level, which covers most stutter patterns Whisper transcribes
   * as separate repeated tokens. */
};

export const DEFAULT_STUTTER_OPTIONS: StutterOptions = {
  removeRepeatedWords: true,
  removeFillerWords: true,
};

const FILLER_WORDS = new Set([
  "um",
  "umm",
  "uh",
  "uhh",
  "erm",
  "er",
  "ah",
  "hmm",
]);

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

/**
 * Walks the word list and returns time ranges to cut:
 *  - all but the LAST occurrence of an immediate repeated word run
 *  - any standalone filler word
 */
export function detectStutterCuts(
  words: TranscriptWord[],
  options: StutterOptions = DEFAULT_STUTTER_OPTIONS
): TimeRange[] {
  const cuts: TimeRange[] = [];
  let i = 0;

  while (i < words.length) {
    const current = normalize(words[i].word);

    if (options.removeFillerWords && FILLER_WORDS.has(current)) {
      cuts.push({ start: words[i].start, end: words[i].end });
      i++;
      continue;
    }

    if (options.removeRepeatedWords) {
      let j = i;
      while (j + 1 < words.length && normalize(words[j + 1].word) === current && current.length > 0) {
        j++;
      }
      if (j > i) {
        // words[i..j-1] are the repeated stutters; words[j] is the kept final one
        cuts.push({ start: words[i].start, end: words[j - 1].end });
        i = j + 1;
        continue;
      }
    }

    i++;
  }

  return mergeRanges(cuts);
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end + 0.02) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}
