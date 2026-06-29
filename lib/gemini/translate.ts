import {
  METADATA_FIELD_LIMITS,
  type MetadataTranslatableField,
} from "@/lib/apple/metadata-limits";
import {
  buildMetadataTranslationPrompt,
  loadMetadataTranslationPrompt,
  type MetadataPromptSource,
} from "./prompts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface MetadataTranslationInput extends MetadataPromptSource {
  apiKey: string;
  model: string;
}

export interface MetadataTranslationResult {
  name: string;
  subtitle: string;
  description: string;
  whatsNew?: string;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

function parseTranslationJson(
  text: string,
  includeWhatsNew: boolean
): MetadataTranslationResult {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(text.trim()) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model did not return valid JSON.");
    }
    parsed = JSON.parse(match[0]) as Record<string, unknown>;
  }

  const result: MetadataTranslationResult = {
    name: String(parsed.name ?? ""),
    subtitle: String(parsed.subtitle ?? ""),
    description: String(parsed.description ?? ""),
  };

  if (includeWhatsNew) {
    result.whatsNew = String(parsed.whatsNew ?? "");
  }

  return result;
}

function getOverLimitFields(
  result: MetadataTranslationResult,
  includeWhatsNew: boolean
): MetadataTranslatableField[] {
  const fields: MetadataTranslatableField[] = ["name", "subtitle", "description"];
  if (includeWhatsNew) fields.push("whatsNew");

  return fields.filter((field) => {
    const value = result[field as keyof MetadataTranslationResult] ?? "";
    return value.length > METADATA_FIELD_LIMITS[field];
  });
}

function enforceHardLimits(
  result: MetadataTranslationResult,
  includeWhatsNew: boolean
): MetadataTranslationResult {
  const limited: MetadataTranslationResult = {
    name: result.name.slice(0, METADATA_FIELD_LIMITS.name),
    subtitle: result.subtitle.slice(0, METADATA_FIELD_LIMITS.subtitle),
    description: result.description.slice(0, METADATA_FIELD_LIMITS.description),
  };

  if (includeWhatsNew) {
    limited.whatsNew = (result.whatsNew ?? "").slice(
      0,
      METADATA_FIELD_LIMITS.whatsNew
    );
  }

  return limited;
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const url = new URL(
    `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });

  const data = (await response.json()) as GeminiGenerateResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Gemini translation request failed.");
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

function buildShortenPrompt(
  result: MetadataTranslationResult,
  overLimit: MetadataTranslatableField[],
  targetLocale: string
): string {
  const violations = overLimit
    .map((field) => {
      const value = result[field as keyof MetadataTranslationResult] ?? "";
      return `- ${field}: ${value.length} chars (max ${METADATA_FIELD_LIMITS[field]})\n  Current: ${JSON.stringify(value)}`;
    })
    .join("\n");

  return `The following App Store metadata fields for locale ${targetLocale} exceed their character limits. Rewrite ONLY the listed fields to fit within the limits while preserving meaning and natural ${targetLocale} phrasing. Return the full JSON object with all fields (name, subtitle, description${overLimit.includes("whatsNew") ? ", whatsNew" : ""}).

Violations:
${violations}

Return ONLY valid JSON.`;
}

export async function translateMetadata(
  input: MetadataTranslationInput
): Promise<MetadataTranslationResult> {
  const template = await loadMetadataTranslationPrompt();
  const prompt = buildMetadataTranslationPrompt(template, input);

  let raw = await callGemini(input.apiKey, input.model, prompt);
  let result = parseTranslationJson(raw, input.includeWhatsNew);

  const overLimit = getOverLimitFields(result, input.includeWhatsNew);
  if (overLimit.length > 0) {
    raw = await callGemini(
      input.apiKey,
      input.model,
      buildShortenPrompt(result, overLimit, input.targetLocale)
    );
    result = parseTranslationJson(raw, input.includeWhatsNew);
  }

  return enforceHardLimits(result, input.includeWhatsNew);
}
