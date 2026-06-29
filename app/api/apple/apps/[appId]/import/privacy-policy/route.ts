import { NextResponse } from "next/server";
import { updatePrivacyPolicyOnly } from "@/lib/apple/localizations";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  appInfoLocalizationId: string;
  locale: string;
  privacyPolicyUrl: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { issuerId, keyId, privateKey, appInfoLocalizationId, locale, privacyPolicyUrl } =
      body;

    if (!issuerId || !keyId || !privateKey) {
      return NextResponse.json(
        { error: "Credentials are required." },
        { status: 400 }
      );
    }

    if (!appInfoLocalizationId || !locale) {
      return NextResponse.json(
        { error: "Localization ID and locale are required." },
        { status: 400 }
      );
    }

    await updatePrivacyPolicyOnly(
      { issuerId, keyId, privateKey, label: body.label },
      appInfoLocalizationId,
      privacyPolicyUrl
    );

    return NextResponse.json({
      locale,
      privacyPolicyUrl,
      appInfoLocalizationId,
    });
  } catch (error) {
    if (error instanceof AppleApiClientError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update privacy policy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
