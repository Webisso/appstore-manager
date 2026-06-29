import type { AppleCredentials } from "@/lib/apple/types";
import { fetchWithTimeout } from "@/lib/async-timeout";
import { SAVE_LOCALIZATION_TIMEOUT_MS } from "@/lib/gemini/timeouts";

const STORAGE_KEY = "asc_credentials";

export function getStoredCredentials(): AppleCredentials | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppleCredentials;
    if (!parsed.issuerId || !parsed.keyId || !parsed.privateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCredentials(credentials: AppleCredentials): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasCredentials(): boolean {
  return getStoredCredentials() !== null;
}

export async function apiPost<T>(
  path: string,
  body: AppleCredentials | (AppleCredentials & Record<string, unknown>),
  timeoutMs = SAVE_LOCALIZATION_TIMEOUT_MS
): Promise<T> {
  const response = await fetchWithTimeout(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data as T;
}

export async function testConnection(
  credentials: AppleCredentials
): Promise<{ success: true; appCount: number }> {
  return apiPost("/api/apple/test", credentials);
}

export async function fetchAppsFromApi(
  credentials: AppleCredentials
): Promise<{ apps: import("@/lib/apple/types").AppSummary[] }> {
  return apiPost("/api/apple/apps", credentials);
}

export async function fetchAppDetailFromApi(
  credentials: AppleCredentials,
  appId: string
): Promise<{ app: import("@/lib/apple/types").AppDetail }> {
  return apiPost(`/api/apple/apps/${appId}`, { ...credentials, appId });
}

export async function saveLocalizationFromApi(
  credentials: AppleCredentials,
  appId: string,
  versionId: string | undefined,
  localization: import("@/lib/apple/types").LocalizationSavePayload
): Promise<{ localization: import("@/lib/apple/types").LocalizationDetail }> {
  return apiPost(`/api/apple/apps/${appId}/localizations`, {
    ...credentials,
    versionId,
    localization,
  });
}

export async function importPrivacyPolicyFromApi(
  credentials: AppleCredentials,
  appId: string,
  payload: {
    appInfoLocalizationId: string;
    locale: string;
    privacyPolicyUrl: string;
  }
): Promise<{ locale: string; privacyPolicyUrl: string; appInfoLocalizationId: string }> {
  return apiPost(`/api/apple/apps/${appId}/import/privacy-policy`, {
    ...credentials,
    ...payload,
  });
}

export async function importVersionUrlsFromApi(
  credentials: AppleCredentials,
  appId: string,
  payload: {
    versionLocalizationId: string;
    locale: string;
    supportUrl: string;
    marketingUrl: string;
  }
): Promise<{
  locale: string;
  supportUrl: string;
  marketingUrl: string;
  versionLocalizationId: string;
}> {
  return apiPost(`/api/apple/apps/${appId}/import/urls`, {
    ...credentials,
    ...payload,
  });
}

export async function fetchLocalizationScreenshotsFromApi(
  credentials: AppleCredentials,
  appId: string,
  versionLocalizationId: string
): Promise<{ screenshots: import("@/lib/apple/types").LocalizationScreenshots }> {
  const { SCREENSHOTS_FETCH_TIMEOUT_MS } = await import("@/lib/gemini/timeouts");
  return apiPost(
    `/api/apple/apps/${appId}/screenshots`,
    { ...credentials, versionLocalizationId },
    SCREENSHOTS_FETCH_TIMEOUT_MS
  );
}

export async function uploadScreenshotFromApi(
  credentials: AppleCredentials,
  appId: string,
  payload: {
    versionLocalizationId: string;
    displayType: string;
    fileName: string;
    imageBase64: string;
    mimeType: string;
  }
): Promise<{ screenshotId: string; setId: string }> {
  const { SCREENSHOT_UPLOAD_TIMEOUT_MS } = await import("@/lib/gemini/timeouts");
  return apiPost(
    `/api/apple/apps/${appId}/screenshots/upload`,
    { ...credentials, ...payload },
    SCREENSHOT_UPLOAD_TIMEOUT_MS
  );
}
