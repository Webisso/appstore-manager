import { NextResponse } from "next/server";
import { fetchAppDetail } from "@/lib/apple/apps";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  appId: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { appId, issuerId, keyId, privateKey, label } = body;

    if (!appId || !issuerId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: "App ID and credentials are required." },
        { status: 400 }
      );
    }

    const detail = await fetchAppDetail(
      { issuerId, keyId, privateKey, label },
      appId
    );

    return NextResponse.json({ app: detail });
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
      error instanceof Error ? error.message : "Failed to fetch app detail.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
