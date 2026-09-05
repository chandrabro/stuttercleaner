import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set on the server. Add it in your Vercel project's Environment Variables.",
      },
      { status: 500 }
    );
  }

  const incomingForm = await req.formData();
  const file = incomingForm.get("audio");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No audio file received." }, { status: 400 });
  }

  const outgoingForm = new FormData();
  outgoingForm.append("file", file, "audio.webm");
  outgoingForm.append("model", "whisper-1");
  outgoingForm.append("response_format", "verbose_json");
  outgoingForm.append("timestamp_granularities[]", "word");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: outgoingForm,
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json(
      { error: `Whisper API error: ${errText}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  // data.words: [{ word, start, end }, ...]
  return NextResponse.json({ words: data.words ?? [], text: data.text ?? "" });
}
