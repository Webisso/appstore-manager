import { NextResponse } from "next/server";
import { listGeminiModels } from "@/lib/gemini/client";

export async function POST(request: Request) {
  try {
    const { apiKey } = (await request.json()) as { apiKey?: string };

    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    const models = await listGeminiModels(apiKey.trim());

    return NextResponse.json(models);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
