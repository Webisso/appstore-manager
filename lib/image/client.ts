import { fetchWithTimeout } from "@/lib/async-timeout";
import type { ResizedScreenshot } from "@/lib/image/resize-iphone-screenshot";

const RESIZE_IPHONE_TIMEOUT_MS = 60_000;

export async function resizeIphoneScreenshotFromApi(payload: {
  imageBase64: string;
}): Promise<ResizedScreenshot> {
  const response = await fetchWithTimeout(
    "/api/image/resize-iphone-screenshot",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    RESIZE_IPHONE_TIMEOUT_MS
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to resize iPhone screenshot.");
  }

  return data as ResizedScreenshot;
}

export function base64ToPreviewUrl(
  imageBase64: string,
  mimeType: string
): string {
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}
