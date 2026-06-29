import { NextResponse } from "next/server";
import { fetchApps } from "@/lib/apple/apps";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

export async function POST(request: Request) {
  try {
    const credentials = (await request.json()) as AppleCredentials;

    if (!credentials.issuerId || !credentials.keyId || !credentials.privateKey) {
      return NextResponse.json(
        { error: "Issuer ID, Key ID, and private key are required." },
        { status: 400 }
      );
    }

    const apps = await fetchApps(credentials);
    return NextResponse.json({ apps });
  } catch (error) {
    if (error instanceof AppleApiClientError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch apps.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
