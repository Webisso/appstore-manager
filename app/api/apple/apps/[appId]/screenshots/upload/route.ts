import { NextResponse } from "next/server";
import { uploadLocalizationScreenshot } from "@/lib/apple/screenshot-upload";
import type { AppleCredentials } from "@/lib/apple/types";
import { AppleApiClientError } from "@/lib/apple/client";

interface RequestBody extends AppleCredentials {
  versionLocalizationId: string;
  displayType: string;
  fileName: string;
  imageBase64: string;
  mimeType: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const {
      issuerId,
      keyId,
      privateKey,
      label,
      versionLocalizationId,
      displayType,
      fileName,
      imageBase64,
      mimeType,
    } = body;

    if (
      !issuerId ||
      !keyId ||
      !privateKey ||
      !versionLocalizationId ||
      !displayType ||
      !fileName ||
      !imageBase64 ||
      !mimeType
    ) {
      return NextResponse.json(
        { error: "Credentials and screenshot upload payload are required." },
        { status: 400 }
      );
    }

    const result = await uploadLocalizationScreenshot(
      { issuerId, keyId, privateKey, label },
      versionLocalizationId,
      { displayType, fileName, imageBase64, mimeType }
    );

    return NextResponse.json(result);
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
        : "Failed to upload screenshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
