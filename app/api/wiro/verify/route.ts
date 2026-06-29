import { NextResponse } from "next/server";
import { verifyWiroCredentials } from "@/lib/wiro/client";

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

    await verifyWiroCredentials({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret?.trim(),
    });

    return NextResponse.json({ verified: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
