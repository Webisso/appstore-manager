import { createHmac } from "crypto";
import type { WiroModelOption, WiroModelsResponse } from "./types";

const WIRO_API_BASE = "https://api.wiro.ai/v1";

const IMAGE_CATEGORIES = new Set([
  "image-generation",
  "image-to-image",
  "image-editing",
]);

interface WiroTool {
  id?: string;
  title?: string;
  cleanslugowner?: string;
  cleanslugproject?: string;
  description?: string;
  categories?: string[];
}

interface WiroToolListResponse {
  result?: boolean;
  errors?: string[];
  total?: number;
  tool?: WiroTool[];
}

export interface WiroCredentials {
  apiKey: string;
  apiSecret?: string;
}

function buildAuthHeaders(credentials: WiroCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": credentials.apiKey,
  };

  if (credentials.apiSecret?.trim()) {
    const nonce = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", credentials.apiKey)
      .update(credentials.apiSecret.trim() + nonce)
      .digest("hex");

    headers["x-nonce"] = nonce;
    headers["x-signature"] = signature;
  }

  return headers;
}

function parseWiroError(body: WiroToolListResponse | null, fallback: string): string {
  if (body?.errors?.length) {
    return body.errors.join(", ");
  }
  return fallback;
}

async function wiroPost<T>(
  credentials: WiroCredentials,
  endpoint: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${WIRO_API_BASE}${endpoint}`, {
    method: "POST",
    headers: buildAuthHeaders(credentials),
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as T & {
    result?: boolean;
    errors?: string[];
  } | null;

  if (!response.ok || body?.result === false) {
    throw new Error(parseWiroError(body, `Wiro API request failed (${response.status}).`));
  }

  return body as T;
}

function toModelOption(tool: WiroTool): WiroModelOption | null {
  const owner = tool.cleanslugowner?.trim();
  const project = tool.cleanslugproject?.trim();
  if (!owner || !project) return null;

  return {
    id: `${owner}/${project}`,
    name: tool.title?.trim() || project,
    description: tool.description?.trim() || undefined,
  };
}

function isImageModel(tool: WiroTool): boolean {
  return (tool.categories ?? []).some((category) => IMAGE_CATEGORIES.has(category));
}

export async function verifyWiroCredentials(credentials: WiroCredentials): Promise<void> {
  await wiroPost<WiroToolListResponse>(credentials, "/Tool/List", {
    start: "0",
    limit: "1",
    hideworkflows: true,
    summary: true,
  });
}

export async function listWiroImageModels(
  credentials: WiroCredentials
): Promise<WiroModelsResponse> {
  const pageSize = 50;
  const allTools: WiroTool[] = [];
  let start = 0;
  let total = Number.POSITIVE_INFINITY;

  while (start < total) {
    const page = await wiroPost<WiroToolListResponse>(credentials, "/Tool/List", {
      start: String(start),
      limit: String(pageSize),
      sort: "id",
      order: "DESC",
      hideworkflows: true,
      summary: true,
    });

    const tools = page.tool ?? [];
    allTools.push(...tools);
    total = Number(page.total ?? tools.length);
    start += tools.length;

    if (tools.length === 0) break;
  }

  const seen = new Set<string>();
  const imageModels = allTools
    .filter(isImageModel)
    .map(toModelOption)
    .filter((option): option is WiroModelOption => {
      if (!option || seen.has(option.id)) return false;
      seen.add(option.id);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (imageModels.length === 0) {
    throw new Error("No image generation or editing models found for this account.");
  }

  return { imageModels };
}
