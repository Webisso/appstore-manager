import {
  METADATA_FIELD_LIMITS,
  type MetadataTranslatableField,
} from "@/lib/apple/metadata-limits";
import { fetchWithTimeout } from "@/lib/async-timeout";
import { mergeTranslationFields } from "./copy-fields";
import {
  buildMetadataLimitCorrectionPrompt,
  buildMetadataTranslationPrompt,
  loadMetadataLimitCorrectionPrompt,
  loadMetadataTranslationPrompt,
  type MetadataPromptSource,
} from "./prompts";
import { GEMINI_REQUEST_TIMEOUT_MS } from "./timeouts";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface MetadataTranslationInput extends MetadataPromptSource {
  apiKey: string;
  model: string;
  translationBase: Record<MetadataTranslatableField, string>;
}

export interface MetadataTranslationResult {
  name: string;
  subtitle: string;
  description: string;
  keywords: string;
  whatsNew?: string;
}

export interface MetadataTranslationOutput {
  translation: MetadataTranslationResult;
  overLimitFields: MetadataTranslatableField[];
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

function toTranslationResult(
  fields: Record<MetadataTranslatableField, string>
): MetadataTranslationResult {
  const result: MetadataTranslationResult = {
    name: fields.name,
    subtitle: fields.subtitle,
    description: fields.description,
    keywords: fields.keywords,
  };
  if (fields.whatsNew !== undefined) {
    result.whatsNew = fields.whatsNew;
  }
  return result;
}

function parseTranslationJson(
  text: string,
  base: Record<MetadataTranslatableField, string>,
  fieldsToMerge: MetadataTranslatableField[]
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

  return toTranslationResult(
    mergeTranslationFields(base, parsed, fieldsToMerge)
  );
}

export function getOverLimitFields(
  result: MetadataTranslationResult,
  fieldsToCheck: MetadataTranslatableField[]
): MetadataTranslatableField[] {
  return fieldsToCheck.filter((field) => {
    const value = result[field as keyof MetadataTranslationResult] ?? "";
    return value.length > METADATA_FIELD_LIMITS[field];
  });
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

  const response = await fetchWithTimeout(
    url.toString(),
    {
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
    },
    GEMINI_REQUEST_TIMEOUT_MS
  );

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

export async function translateMetadataInitial(
  input: MetadataTranslationInput
): Promise<MetadataTranslationOutput> {
  const template = await loadMetadataTranslationPrompt();
  const prompt = buildMetadataTranslationPrompt(template, input);

  const raw = await callGemini(input.apiKey, input.model, prompt);
  const base = input.translationBase;
  const translation = parseTranslationJson(
    raw,
    base,
    input.fieldsToTranslate
  );

  return {
    translation,
    overLimitFields: getOverLimitFields(translation, input.fieldsToTranslate),
  };
}

export interface MetadataLimitCorrectionInput {
  apiKey: string;
  model: string;
  targetLocale: string;
  translation: MetadataTranslationResult;
  overLimitFields: MetadataTranslatableField[];
  includeWhatsNew: boolean;
  translationBase: Record<MetadataTranslatableField, string>;
}

export async function correctMetadataLimits(
  input: MetadataLimitCorrectionInput
): Promise<MetadataTranslationOutput> {
  const template = await loadMetadataLimitCorrectionPrompt();
  const prompt = buildMetadataLimitCorrectionPrompt(template, {
    targetLocale: input.targetLocale,
    name: input.translation.name,
    subtitle: input.translation.subtitle,
    description: input.translation.description,
    keywords: input.translation.keywords,
    whatsNew: input.translation.whatsNew,
    includeWhatsNew: input.includeWhatsNew,
    overLimitFields: input.overLimitFields,
  });

  const raw = await callGemini(input.apiKey, input.model, prompt);
  const translation = parseTranslationJson(
    raw,
    input.translationBase,
    input.overLimitFields
  );

  return {
    translation,
    overLimitFields: getOverLimitFields(translation, input.overLimitFields),
  };
}

export async function translateMetadata(
  input: MetadataTranslationInput
): Promise<MetadataTranslationResult> {
  let { translation, overLimitFields } = await translateMetadataInitial(input);

  if (overLimitFields.length > 0) {
    const corrected = await correctMetadataLimits({
      apiKey: input.apiKey,
      model: input.model,
      targetLocale: input.targetLocale,
      translation,
      overLimitFields,
      includeWhatsNew: input.includeWhatsNew,
      translationBase: input.translationBase,
    });
    translation = corrected.translation;
    overLimitFields = corrected.overLimitFields;
  }

  if (overLimitFields.length > 0) {
    const fields = overLimitFields.join(", ");
    throw new Error(
      `Translation still exceeds character limits after correction: ${fields}`
    );
  }

  return translation;
}
