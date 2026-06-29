import { NextResponse } from "next/server";
import { updateVersionUrlsOnly } from "@/lib/apple/localizations";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  versionLocalizationId: string;
  locale: string;
  supportUrl: string;
  marketingUrl: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const {
      issuerId,
      keyId,
      privateKey,
      versionLocalizationId,
      locale,
      supportUrl,
      marketingUrl,
    } = body;

    if (!issuerId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: "Credentials are required." },
        { status: 400 }
      );
    }

    if (!versionLocalizationId || !locale) {
      return NextResponse.json(
        { error: "Version localization ID and locale are required." },
        { status: 400 }
      );
    }

    await updateVersionUrlsOnly(
      { issuerId, keyId, privateKey, label: body.label },
      versionLocalizationId,
      supportUrl,
      marketingUrl
    );

    return NextResponse.json({
      locale,
      supportUrl,
      marketingUrl,
      versionLocalizationId,
    });
  } catch (error) {
    if (error instanceof AppleApiClientError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update URLs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
