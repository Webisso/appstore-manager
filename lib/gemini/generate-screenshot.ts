import { fetchWithTimeout } from "@/lib/async-timeout";
import {
  buildScreenshotLocalizationPrompt,
  loadScreenshotLocalizationPrompt,
  type ScreenshotPromptInput,
} from "./screenshot-prompts";
import { GEMINI_IMAGE_REQUEST_TIMEOUT_MS } from "./timeouts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message?: string };
}

export interface GenerateLocalizedScreenshotInput extends ScreenshotPromptInput {
  apiKey: string;
  model: string;
  sourceImageUrl: string;
}

export interface GeneratedScreenshotResult {
  imageBase64: string;
  mimeType: string;
}

function isImagenModel(model: string): boolean {
  return model.toLowerCase().includes("imagen");
}

async function fetchSourceImage(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to download source screenshot (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const mimeType = contentType.split(";")[0]?.trim() || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    base64: buffer.toString("base64"),
    mimeType,
  };
}

function extractGeneratedImage(
  parts: GeminiPart[] | undefined
): GeneratedScreenshotResult | null {
  if (!parts) return null;

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        imageBase64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  return null;
}

export async function generateLocalizedScreenshot(
  input: GenerateLocalizedScreenshotInput
): Promise<GeneratedScreenshotResult> {
  if (isImagenModel(input.model)) {
    throw new Error(
      "Screenshot localization requires a Gemini image model (e.g. Gemini Flash Image). Imagen models do not support reference-image editing."
    );
  }

  const [template, sourceImage] = await Promise.all([
    loadScreenshotLocalizationPrompt(),
    fetchSourceImage(input.sourceImageUrl),
  ]);

  const prompt = buildScreenshotLocalizationPrompt(template, input);

  const url = new URL(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(input.model)}:generateContent`
  );
  url.searchParams.set("key", input.apiKey);

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: sourceImage.mimeType,
                  data: sourceImage.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.4,
        },
      }),
    },
    GEMINI_IMAGE_REQUEST_TIMEOUT_MS
  );

  const data = (await response.json()) as GeminiGenerateResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini image generation failed.");
  }

  const image = extractGeneratedImage(data.candidates?.[0]?.content?.parts);
  if (!image) {
    throw new Error("Gemini did not return an image.");
  }

  return image;
}
