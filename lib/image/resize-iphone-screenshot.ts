import sharp from "sharp";
import {
  IPHONE_UPLOAD_HEIGHT,
  IPHONE_UPLOAD_WIDTH,
} from "@/lib/apple/screenshot-dimensions";

export interface ResizedScreenshot {
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
}

export async function resizeIphoneScreenshot(
  input: Buffer | Uint8Array
): Promise<ResizedScreenshot> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);

  const output = await sharp(buffer)
    .resize(IPHONE_UPLOAD_WIDTH, IPHONE_UPLOAD_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();

  return {
    imageBase64: output.toString("base64"),
    mimeType: "image/png",
    width: IPHONE_UPLOAD_WIDTH,
    height: IPHONE_UPLOAD_HEIGHT,
  };
}

export async function resizeIphoneScreenshotFromBase64(
  imageBase64: string
): Promise<ResizedScreenshot> {
  return resizeIphoneScreenshot(Buffer.from(imageBase64, "base64"));
}
