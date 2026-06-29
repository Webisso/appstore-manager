import type { GeminiSettings } from "./types";

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

export interface TranslateMetadataRequest {
  apiKey: string;
  model: string;
  sourceLocale: string;
  targetLocale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  whatsNew?: string;
  includeWhatsNew?: boolean;
}

export interface TranslateMetadataResponse {
  translation: {
    name: string;
    subtitle: string;
    description: string;
    whatsNew?: string;
  };
}

export async function translateMetadataFromApi(
  payload: TranslateMetadataRequest
): Promise<TranslateMetadataResponse> {
  const response = await fetch("/api/gemini/translate-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Translation failed.");
  }

  return data as TranslateMetadataResponse;
}
