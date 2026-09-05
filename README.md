# ClearSpeech

Upload a recording, and ClearSpeech:

1. **Trims pauses** — non-AI, runs instantly in your browser by scanning the
   audio's volume for gaps between words and shrinking them down.
2. **Removes stammered/repeated words and filler words** (optional) — gets
   word-level timestamps, finds patterns like "I I I want" and cuts
   everything but the last "I", plus words like "um"/"uh". You pick the
   engine that does the transcription:
   - **Free, in your browser** — runs Whisper entirely client-side via
     WebAssembly (loaded from a CDN at runtime, nothing to install). The
     model (~80MB) downloads once per browser and is cached after that. No
     API key, no account, no per-use cost, nothing leaves the person's
     device.
   - **OpenAI API, paid** — sends the audio to OpenAI's Whisper endpoint.
     Slightly faster and a bit more accurate, costs a small amount per
     minute of audio, and needs `OPENAI_API_KEY` set on the server.
3. **Cuts precisely with ffmpeg**, running as WebAssembly *in the browser* —
   no audio ever needs a heavy server, which is why this fits comfortably on
   Vercel's free tier.

Everything works with zero configuration and zero cost using the free
in-browser engine. The OpenAI engine is entirely optional.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

The free "runs in your browser" AI engine needs no setup at all — just pick
it in the UI. If you also want the paid OpenAI engine available, copy
`.env.example` to `.env.local` and add your OpenAI key:

```bash
cp .env.example .env.local
# then edit .env.local and paste your key
```

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create clearspeech --public --source=. --push
```

(No `gh` CLI? Create an empty repo on github.com, then:
`git remote add origin <your-repo-url>` and `git push -u origin main`.)

## Deploy to Vercel

1. Go to https://vercel.com/new and import the GitHub repo you just pushed.
2. Vercel will auto-detect it as a Next.js app — no build settings to change.
3. Deploy. That's it — pause trimming and the free in-browser AI engine both
   work immediately with zero configuration.
4. Only if you also want the paid OpenAI engine available, add an
   environment variable:
   - **Settings → Environment Variables**
   - Name: `OPENAI_API_KEY`, Value: your key, apply to Production (and
     Preview if you want).

## How the "keep AI safe" part works

The `/api/transcribe` route is the only server code in the app — it takes
your uploaded audio, forwards it to OpenAI with your key attached, and
returns word timestamps. Your OpenAI key never reaches the browser.

## Tuning the pause detector

If it's cutting words short or leaving pauses that are too long, adjust in
the UI:
- **Sensitivity** — how quiet a moment has to be to count as a pause.
- **Minimum pause length** — pauses shorter than this are left alone (so
  natural breathing/consonant gaps aren't chopped).

Both are non-AI and computed entirely client-side from the audio's volume,
so there's no cost or upload involved in that part.

## Known limits / next steps

- The free in-browser engine (`whisper-base` via transformers.js) is a
  smaller, quantized model — good accuracy for clear speech, but a notch
  below OpenAI's hosted Whisper on noisy audio or accents. It also needs a
  reasonably modern browser/device; very old phones may run it slowly.
- The OpenAI API caps uploads at 25MB — for longer recordings with that
  engine, you'd want to chunk the audio before transcribing.
- Repeated-word detection is word-level (relies on Whisper splitting a
  stutter into separate tokens). Very fast within-word stutters ("s-s-see")
  may not be transcribed as separate words and won't be caught — that would
  need phoneme-level analysis, a bigger undertaking.
- Output is currently WAV; if file size matters, ffmpeg.wasm could export
  to MP3/AAC instead — just change the output filename/args in
  `lib/ffmpegProcessor.ts`.
