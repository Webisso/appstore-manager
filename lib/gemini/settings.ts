import type { GeminiSettings } from "./types";
import { fetchWithTimeout } from "@/lib/async-timeout";
import {
  TRANSLATE_API_TIMEOUT_MS,
} from "./timeouts";

const STORAGE_KEY = "gemini_settings";

export function getGeminiSettings(): GeminiSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeminiSettings;
    if (!parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGeminiSettings(settings: GeminiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearGeminiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasGeminiSettings(): boolean {
  const settings = getGeminiSettings();
  return Boolean(settings?.apiKey && settings?.verified);
}

export async function verifyGeminiApi(apiKey: string): Promise<{ verified: true }> {
  const response = await fetch("/api/gemini/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Verification failed.");
  }

  return data as { verified: true };
}

export async function fetchGeminiModels(
  apiKey: string
): Promise<import("./types").GeminiModelsResponse> {
  const response = await fetch("/api/gemini/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch models.");
  }

  return data as import("./types").GeminiModelsResponse;
}

import type { MetadataTranslatableField } from "@/lib/apple/metadata-limits";

export interface TranslateMetadataRequest {
  apiKey: string;
  model: string;
  sourceLocale: string;
  targetLocale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  includeWhatsNew?: boolean;
  fieldsToTranslate: MetadataTranslatableField[];
  translationBase: Record<MetadataTranslatableField, string>;
}

export interface TranslateMetadataResponse {
  translation: {
    name: string;
    subtitle: string;
    description: string;
    keywords: string;
    whatsNew?: string;
  };
  overLimitFields?: string[];
}

export async function translateMetadataFromApi(
  payload: TranslateMetadataRequest
): Promise<TranslateMetadataResponse> {
  const response = await fetchWithTimeout(
    "/api/gemini/translate-metadata",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action: "translate" }),
    },
    TRANSLATE_API_TIMEOUT_MS
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Translation failed.");
  }

  return data as TranslateMetadataResponse;
}

export interface CorrectMetadataLimitsRequest {
  apiKey: string;
  model: string;
  targetLocale: string;
  translation: TranslateMetadataResponse["translation"];
  overLimitFields: string[];
  includeWhatsNew?: boolean;
  translationBase: Record<MetadataTranslatableField, string>;
}

export async function correctMetadataLimitsFromApi(
  payload: CorrectMetadataLimitsRequest
): Promise<TranslateMetadataResponse> {
  const response = await fetchWithTimeout(
    "/api/gemini/translate-metadata",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action: "correct" }),
    },
    TRANSLATE_API_TIMEOUT_MS
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Limit correction failed.");
  }

  return data as TranslateMetadataResponse;
}

export interface GenerateScreenshotRequest {
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

export interface GenerateScreenshotResponse {
  imageBase64: string;
  mimeType: string;
}

export async function generateScreenshotFromApi(
  payload: GenerateScreenshotRequest
): Promise<GenerateScreenshotResponse> {
  const { GENERATE_SCREENSHOT_API_TIMEOUT_MS } = await import("./timeouts");
  const response = await fetchWithTimeout(
    "/api/gemini/generate-screenshot",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    GENERATE_SCREENSHOT_API_TIMEOUT_MS
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Screenshot generation failed.");
  }

  return data as GenerateScreenshotResponse;
}
