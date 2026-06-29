import { NextResponse } from "next/server";
import { saveLocalization } from "@/lib/apple/localizations";
import type { AppleCredentials, LocalizationSavePayload } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  versionId?: string;
  localization: LocalizationSavePayload;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { issuerId, keyId, privateKey, label, versionId, localization } =
      body;

    if (!issuerId || !keyId || !privateKey || !localization?.locale) {
      return NextResponse.json(
        { error: "Credentials and localization locale are required." },
        { status: 400 }
      );
    }

    const updated = await saveLocalization(
      { issuerId, keyId, privateKey, label },
      localization,
      versionId
    );

    return NextResponse.json({ localization: updated });
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
      error instanceof Error ? error.message : "Failed to save localization.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
