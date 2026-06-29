import { NextResponse } from "next/server";
import { resizeIphoneScreenshotFromBase64 } from "@/lib/image/resize-iphone-screenshot";

interface RequestBody {
  imageBase64: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required." },
        { status: 400 }
      );
    }

    const result = await resizeIphoneScreenshotFromBase64(imageBase64);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resize screenshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
