import { NextResponse } from "next/server";
import { verifyGeminiApiKey } from "@/lib/gemini/client";

export async function POST(request: Request) {
  try {
    const { apiKey } = (await request.json()) as { apiKey?: string };

    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    await verifyGeminiApiKey(apiKey.trim());

    return NextResponse.json({ verified: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
