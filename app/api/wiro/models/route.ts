import { NextResponse } from "next/server";
import { listWiroImageModels } from "@/lib/wiro/client";

export async function POST(request: Request) {
  try {
    const { apiKey, apiSecret } = (await request.json()) as {
      apiKey?: string;
      apiSecret?: string;
    };

    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    const models = await listWiroImageModels({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret?.trim(),
    });

    return NextResponse.json(models);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
