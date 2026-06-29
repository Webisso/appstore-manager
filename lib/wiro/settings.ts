import type { WiroSettings } from "./types";

const STORAGE_KEY = "wiro_settings";

export function getWiroSettings(): WiroSettings | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WiroSettings;
    if (!parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWiroSettings(settings: WiroSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearWiroSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasWiroSettings(): boolean {
  const settings = getWiroSettings();
  return Boolean(settings?.apiKey && settings?.verified);
}

export async function verifyWiroApi(
  apiKey: string,
  apiSecret: string
): Promise<{ verified: true }> {
  const response = await fetch("/api/wiro/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Verification failed.");
  }

  return data as { verified: true };
}

export async function fetchWiroModels(
  apiKey: string,
  apiSecret: string
): Promise<import("./types").WiroModelsResponse> {
  const response = await fetch("/api/wiro/models", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, apiSecret }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch models.");
  }

  return data as import("./types").WiroModelsResponse;
}
