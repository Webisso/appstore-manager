import type { GeminiModelOption, GeminiModelsResponse } from "./types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GoogleModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

interface GoogleModelsListResponse {
  models?: GoogleModel[];
  nextPageToken?: string;
}

function normalizeModelId(name: string): string {
  return name.replace(/^models\//, "");
}

function toOption(model: GoogleModel): GeminiModelOption {
  return {
    id: normalizeModelId(model.name),
    name: model.displayName || normalizeModelId(model.name),
    description: model.description,
  };
}

const FALLBACK_TEXT_MODELS: GeminiModelOption[] = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
];

const FALLBACK_IMAGE_MODELS: GeminiModelOption[] = [
  { id: "gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image (Nano Banana)" },
  { id: "gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash Image (Nano Banana 2)" },
  { id: "gemini-3-pro-image-preview", name: "Gemini 3 Pro Image (Nano Banana Pro)" },
  { id: "imagen-4.0-generate-001", name: "Imagen 4.0 Generate" },
];

/** Gemini native image models (Nano Banana, etc.) + Imagen models. */
function isImageGenerationModel(model: GoogleModel): boolean {
  const id = normalizeModelId(model.name).toLowerCase();
  const display = (model.displayName ?? "").toLowerCase();
  const description = (model.description ?? "").toLowerCase();
  const methods = model.supportedGenerationMethods ?? [];

  if (id.includes("imagen")) return true;
  if (id.includes("imagegen")) return true;
  if (id.includes("-flash-image") || id.includes("-pro-image")) return true;
  if (id.includes("image-generation") || id.includes("generate-image")) return true;
  if (display.includes("nano banana")) return true;
  if (
    description.includes("image generation") ||
    description.includes("generate images") ||
    description.includes("generates images")
  ) {
    return true;
  }

  if (
    methods.includes("predict") &&
    (id.includes("imagen") || id.includes("imagegen"))
  ) {
    return true;
  }

  return false;
}

function isTextGenerationModel(model: GoogleModel): boolean {
  const id = normalizeModelId(model.name).toLowerCase();
  const methods = model.supportedGenerationMethods ?? [];

  if (!methods.includes("generateContent")) return false;
  if (isImageGenerationModel(model)) return false;
  if (id.includes("embedding") || id.includes("aqa") || id.includes("tts")) {
    return false;
  }
  if (id.includes("veo") || id.includes("live")) return false;

  return true;
}

async function fetchAllModels(apiKey: string): Promise<GoogleModel[]> {
  const all: GoogleModel[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GEMINI_API_BASE}/models`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), { cache: "no-store" });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? "Failed to list Gemini models.");
    }

    const data = (await response.json()) as GoogleModelsListResponse;
    all.push(...(data.models ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return all;
}

export async function verifyGeminiApiKey(apiKey: string): Promise<void> {
  const url = new URL(`${GEMINI_API_BASE}/models`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("pageSize", "1");

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? "Invalid Gemini API key.");
  }
}

export async function listGeminiModels(
  apiKey: string
): Promise<GeminiModelsResponse> {
  const models = await fetchAllModels(apiKey);

  const textModels = models.filter(isTextGenerationModel).map(toOption);

  const imageModels = models.filter(isImageGenerationModel).map(toOption);

  // Deduplicate by id
  const dedupe = (items: GeminiModelOption[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const uniqueText = dedupe(textModels);
  const uniqueImage = dedupe(imageModels);

  // Sort: Gemini image models first, then Imagen
  uniqueImage.sort((a, b) => {
    const aGemini = a.id.startsWith("gemini");
    const bGemini = b.id.startsWith("gemini");
    if (aGemini && !bGemini) return -1;
    if (!aGemini && bGemini) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    textModels: uniqueText.length > 0 ? uniqueText : FALLBACK_TEXT_MODELS,
    imageModels: uniqueImage.length > 0 ? uniqueImage : FALLBACK_IMAGE_MODELS,
  };
}
