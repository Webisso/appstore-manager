import { generateAppleJwt } from "./auth";
import type { AppleApiError, AppleCredentials } from "./types";

export const APPLE_API_BASE = "https://api.appstoreconnect.apple.com/v1";

export class AppleApiClientError extends Error {
  status: number;
  details?: AppleApiError["errors"];

  constructor(message: string, status: number, details?: AppleApiError["errors"]) {
    super(message);
    this.name = "AppleApiClientError";
    this.status = status;
    this.details = details;
  }
}

export interface AppleFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  searchParams?: Record<string, string | number | undefined>;
}

export async function appleFetch<T>(
  credentials: AppleCredentials,
  path: string,
  options: AppleFetchOptions = {}
): Promise<T> {
  const token = await generateAppleJwt(credentials);
  const url = new URL(
    path.startsWith("http") ? path : `${APPLE_API_BASE}${path.startsWith("/") ? path : `/${path}`}`
  );

  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    let errorBody: AppleApiError | undefined;
    try {
      errorBody = (await response.json()) as AppleApiError;
    } catch {
      // ignore parse errors
    }

    const detail =
      errorBody?.errors?.[0]?.detail ??
      errorBody?.errors?.[0]?.title ??
      response.statusText;

    throw new AppleApiClientError(
      detail || "Apple API request failed.",
      response.status,
      errorBody?.errors
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
