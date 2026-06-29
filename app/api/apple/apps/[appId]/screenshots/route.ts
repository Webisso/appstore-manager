import { NextResponse } from "next/server";
import { fetchLocalizationScreenshots } from "@/lib/apple/screenshots";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  versionLocalizationId: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { issuerId, keyId, privateKey, label, versionLocalizationId } = body;

    if (!issuerId || !keyId || !privateKey || !versionLocalizationId) {
      return NextResponse.json(
        {
          error:
            "Credentials and version localization ID are required.",
        },
        { status: 400 }
      );
    }

    const screenshots = await fetchLocalizationScreenshots(
      { issuerId, keyId, privateKey, label },
      versionLocalizationId
    );

    return NextResponse.json({ screenshots });
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
      error instanceof Error
        ? error.message
        : "Failed to fetch localization screenshots.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
