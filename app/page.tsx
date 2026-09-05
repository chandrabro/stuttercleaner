"use client";

import { useCallback, useRef, useState } from "react";
import Waveform from "@/components/Waveform";
import { decodeAudioFile } from "@/lib/decodeAudio";
import { detectExcessSilence, type TimeRange } from "@/lib/silenceDetector";
import { detectStutterCuts, type TranscriptWord } from "@/lib/stutterDetector";
import { invertToKeepRanges, mergeRanges, totalCutSeconds } from "@/lib/segments";
import { renderCleanedAudio } from "@/lib/ffmpegProcessor";
import { resampleTo16kMono } from "@/lib/resample";
import { transcribeInBrowser, type ModelProgress } from "@/lib/browserTranscriber";

type Stage =
  | "idle"
  | "decoding"
  | "downloading-model"
  | "transcribing"
  | "detecting"
  | "rendering"
  | "done"
  | "error";

type AIEngine = "off" | "free" | "openai";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cleanedUrl, setCleanedUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsRemoved, setSecondsRemoved] = useState<number | null>(null);

  const [sensitivity, setSensitivity] = useState(0.02); // amplitude threshold
  const [minPauseMs, setMinPauseMs] = useState(400);
  const [aiEngine, setAiEngine] = useState<AIEngine>("off");
  const [removeRepeats, setRemoveRepeats] = useState(true);
  const [removeFillers, setRemoveFillers] = useState(true);
  const [modelPct, setModelPct] = useState(0);

  const bufferRef = useRef<AudioBuffer | null>(null);

  const onFileChosen = useCallback(async (chosen: File) => {
    setFile(chosen);
    setCleanedUrl(null);
    setErrorMsg(null);
    setStage("decoding");
    const url = URL.createObjectURL(chosen);
    setOriginalUrl(url);
    try {
      bufferRef.current = await decodeAudioFile(chosen);
      setStage("idle");
    } catch (e) {
      setErrorMsg("Couldn't read that audio file. Try a WAV, MP3, or M4A file.");
      setStage("error");
    }
  }, []);

  const handleClean = useCallback(async () => {
    if (!file || !bufferRef.current) return;
    setErrorMsg(null);
    setCleanedUrl(null);
    setProgress(0);

    try {
      const buffer = bufferRef.current;
      let cuts: TimeRange[] = detectExcessSilence(buffer, {
        amplitudeThreshold: sensitivity,
        minSilenceMs: minPauseMs,
        keepPaddingMs: 120,
      });

      if (aiEngine === "free") {
        setStage("downloading-model");
        setModelPct(0);
        const mono16k = await resampleTo16kMono(buffer);
        const words = await transcribeInBrowser(mono16k, (p: ModelProgress) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            setModelPct(p.progress);
          }
          if (p.status === "ready" || p.status === "done") {
            setStage("transcribing");
          }
        });
        setStage("detecting");
        const stutterCuts = detectStutterCuts(words, {
          removeRepeatedWords: removeRepeats,
          removeFillerWords: removeFillers,
        });
        cuts = mergeRanges([...cuts, ...stutterCuts]);
      } else if (aiEngine === "openai") {
        setStage("transcribing");
        const form = new FormData();
        form.append("audio", file);
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Transcription failed.");
        const words: TranscriptWord[] = data.words;
        setStage("detecting");
        const stutterCuts = detectStutterCuts(words, {
          removeRepeatedWords: removeRepeats,
          removeFillerWords: removeFillers,
        });
        cuts = mergeRanges([...cuts, ...stutterCuts]);
      }

      setSecondsRemoved(totalCutSeconds(cuts));
      const keepRanges = invertToKeepRanges(cuts, buffer.duration);

      setStage("rendering");
      const blob = await renderCleanedAudio(file, keepRanges, (f) => setProgress(f));
      setCleanedUrl(URL.createObjectURL(blob));
      setStage("done");
    } catch (e: any) {
      setErrorMsg(e.message || "Something went wrong while processing the audio.");
      setStage("error");
    }
  }, [file, sensitivity, minPauseMs, aiEngine, removeRepeats, removeFillers]);

  const busy =
    stage === "decoding" ||
    stage === "downloading-model" ||
    stage === "transcribing" ||
    stage === "detecting" ||
    stage === "rendering";

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-14 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end">
        <div>
          <p className="font-mono text-xs text-mute">clearspeech</p>
          <h1 className="mt-2 font-display text-6xl leading-[1.05] text-ink">
            Say it once.
            <br />
            Keep it clean.
          </h1>
          <p className="mt-4 max-w-md text-mute">
            Upload a recording and ClearSpeech trims the dead air and smooths
            over repeated words automatically — so what you meant to say is
            what people hear.
          </p>
        </div>
        <WaveDoodle />
      </header>

      <section className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        {/* Controls */}
        <div className="space-y-5">
          <UploadBox onFile={onFileChosen} fileName={file?.name ?? null} />

          <div className="rounded-lg border border-line bg-panel p-5">
            <h2 className="font-medium text-ink">Pause trimming</h2>
            <p className="mt-1 text-sm text-mute">
              Works instantly, no account or API key needed.
            </p>

            <label className="mt-4 block text-sm text-ink">
              Sensitivity
              <input
                type="range"
                min={0.005}
                max={0.08}
                step={0.005}
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="mt-1 w-full accent-teal"
              />
              <span className="font-mono text-xs text-mute">
                {sensitivity < 0.02 ? "catches quiet pauses" : sensitivity > 0.05 ? "only obvious silence" : "balanced"}
              </span>
            </label>

            <label className="mt-4 block text-sm text-ink">
              Minimum pause length: <span className="font-mono">{minPauseMs}ms</span>
              <input
                type="range"
                min={150}
                max={1200}
                step={50}
                value={minPauseMs}
                onChange={(e) => setMinPauseMs(parseInt(e.target.value))}
                className="mt-1 w-full accent-teal"
              />
            </label>
          </div>

          <div className="rounded-lg border border-line bg-panel p-5">
            <span className="font-medium text-ink">AI stutter removal</span>
            <p className="mt-1 text-sm text-mute">
              Transcribes your audio to find and cut repeated words
              ("I I I want") and filler words.
            </p>

            <div className="mt-4 space-y-2">
              <EngineOption
                id="off"
                title="Off"
                description="Pause trimming only."
                selected={aiEngine === "off"}
                onSelect={() => setAiEngine("off")}
              />
              <EngineOption
                id="free"
                title="Free — runs in your browser"
                description="Downloads a small speech model once (~80MB, cached after). No account, no cost, nothing leaves your device."
                selected={aiEngine === "free"}
                onSelect={() => setAiEngine("free")}
              />
              <EngineOption
                id="openai"
                title="OpenAI API — paid, most accurate"
                description="Faster and slightly more accurate. Needs an OPENAI_API_KEY set on the server, and costs a small amount per minute of audio."
                selected={aiEngine === "openai"}
                onSelect={() => setAiEngine("openai")}
              />
            </div>

            {aiEngine !== "off" && (
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                <ToggleRow
                  label="Collapse repeated words"
                  checked={removeRepeats}
                  onChange={setRemoveRepeats}
                />
                <ToggleRow
                  label="Remove filler words (um, uh...)"
                  checked={removeFillers}
                  onChange={setRemoveFillers}
                />
              </div>
            )}
          </div>

          <button
            onClick={handleClean}
            disabled={!file || busy}
            className="w-full rounded-lg bg-teal py-3 font-medium text-white transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? stageLabel(stage, progress, modelPct) : "Clean my audio"}
          </button>

          {errorMsg && (
            <p className="rounded-lg border border-amber/40 bg-amber-light px-4 py-3 text-sm text-amber">
              {errorMsg}
            </p>
          )}

          {secondsRemoved !== null && stage === "done" && (
            <p className="text-sm text-mute">
              Removed{" "}
              <span className="font-mono text-teal-dark">
                {secondsRemoved.toFixed(1)}s
              </span>{" "}
              of pauses and stammers.
            </p>
          )}
        </div>

        {/* Previews */}
        <div className="space-y-4">
          <Waveform audioUrl={originalUrl} label="Original" waveColor="#B9C2C8" progressColor="#6B7580" />
          <Waveform audioUrl={cleanedUrl} label="Cleaned" waveColor="#2E7D6B" progressColor="#1F5A4C" />
          {cleanedUrl && (
            <a
              href={cleanedUrl}
              download="clearspeech-cleaned.wav"
              className="block w-full rounded-lg border border-teal py-3 text-center font-medium text-teal-dark hover:bg-teal-light"
            >
              Download cleaned audio (.wav)
            </a>
          )}
        </div>
      </section>
    </main>
  );
}

function stageLabel(stage: Stage, progress: number, modelPct: number) {
  switch (stage) {
    case "decoding":
      return "Reading audio…";
    case "downloading-model":
      return `Downloading free AI model… ${Math.round(modelPct)}%`;
    case "transcribing":
      return "Transcribing speech…";
    case "detecting":
      return "Finding stutters…";
    case "rendering":
      return `Rendering… ${Math.round(progress * 100)}%`;
    default:
      return "Working…";
  }
}

function EngineOption({
  title,
  description,
  selected,
  onSelect,
}: {
  id: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        selected ? "border-teal bg-teal-light" : "border-line hover:border-mute"
      }`}
    >
      <span className={`text-sm font-medium ${selected ? "text-teal-dark" : "text-ink"}`}>
        {title}
      </span>
      <p className="mt-0.5 text-xs text-mute">{description}</p>
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm text-ink">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-teal"
      />
    </label>
  );
}

function UploadBox({
  onFile,
  fileName,
}: {
  onFile: (f: File) => void;
  fileName: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className="cursor-pointer rounded-lg border-2 border-dashed border-line bg-panel p-8 text-center transition hover:border-teal"
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <p className="font-medium text-ink">
        {fileName ? fileName : "Drop an audio file, or click to choose one"}
      </p>
      <p className="mt-1 text-sm text-mute">WAV, MP3, M4A — processed in your browser</p>
    </div>
  );
}

function WaveDoodle() {
  const bars = [8, 20, 12, 32, 18, 28, 10, 24, 14, 30, 16, 9];
  return (
    <div className="flex h-16 items-end justify-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-2 rounded-full bg-teal/70"
          style={{ height: `${h * 2}px`, opacity: 0.4 + (i % 4) * 0.15 }}
        />
      ))}
    </div>
  );
}
