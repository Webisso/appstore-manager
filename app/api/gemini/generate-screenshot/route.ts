import { NextResponse } from "next/server";
import { generateLocalizedScreenshot } from "@/lib/gemini/generate-screenshot";

interface RequestBody {
  apiKey: string;
  model: string;
  sourceImageUrl: string;
  sourceLocale: string;
  targetLocale: string;
  displayType: string;
  displayLabel: string;
  screenshotIndex: number;
  totalInSet: number;
  sourceWidth: number;
  sourceHeight: number;
  customInstructions?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const {
      apiKey,
      model,
      sourceImageUrl,
      sourceLocale,
      targetLocale,
      displayType,
      displayLabel,
      screenshotIndex,
      totalInSet,
      sourceWidth,
      sourceHeight,
      customInstructions,
    } = body;

    if (
      !apiKey ||
      !model ||
      !sourceImageUrl ||
      !sourceLocale ||
      !targetLocale ||
      !displayType ||
      !displayLabel ||
      !screenshotIndex ||
      !totalInSet ||
      !sourceWidth ||
      !sourceHeight
    ) {
      return NextResponse.json(
        { error: "Missing required fields for screenshot generation." },
        { status: 400 }
      );
    }

    const result = await generateLocalizedScreenshot({
      apiKey,
      model,
      sourceImageUrl,
      sourceLocale,
      targetLocale,
      displayType,
      displayLabel,
      screenshotIndex,
      totalInSet,
      sourceWidth,
      sourceHeight,
      customInstructions,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Screenshot generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
