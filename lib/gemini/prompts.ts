import { readFile } from "fs/promises";
import path from "path";
import {
  METADATA_FIELD_LIMITS,
  type MetadataTranslatableField,
} from "@/lib/apple/metadata-limits";
import { getLocalePromptLabel } from "@/lib/locale-display";

let cachedMetadataPrompt: string | null = null;
let cachedLimitCorrectionPrompt: string | null = null;

export async function loadMetadataTranslationPrompt(): Promise<string> {
  if (!cachedMetadataPrompt) {
    cachedMetadataPrompt = await readFile(
      path.join(process.cwd(), "public/prompts/metadata-translation.txt"),
      "utf-8"
    );
  }
  return cachedMetadataPrompt;
}

export async function loadMetadataLimitCorrectionPrompt(): Promise<string> {
  if (!cachedLimitCorrectionPrompt) {
    cachedLimitCorrectionPrompt = await readFile(
      path.join(process.cwd(), "public/prompts/metadata-limit-correction.txt"),
      "utf-8"
    );
  }
  return cachedLimitCorrectionPrompt;
}

export interface MetadataPromptSource {
  sourceLocale: string;
  targetLocale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  keywords?: string;
  whatsNew?: string;
  includeWhatsNew: boolean;
  fieldsToTranslate: MetadataTranslatableField[];
}

function emptyOr(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "(empty)";
}

const FIELD_RULE_TEXT: Record<MetadataTranslatableField, string> = {
  name: `**name** — Short app title for the App Store listing. Must fit in ${METADATA_FIELD_LIMITS.name} characters. Keep brand names unchanged unless the brand has an official localized name. Do not add subtitles or taglines here.`,
  subtitle: `**subtitle** — One concise value proposition shown under the app name. Must fit in ${METADATA_FIELD_LIMITS.subtitle} characters. No trailing punctuation unless natural for the locale.`,
  description: `**description** — Full App Store description. Preserve paragraph breaks and bullet-style formatting from the source. Adapt marketing tone for the target locale readers. Must not exceed ${METADATA_FIELD_LIMITS.description} characters.`,
  keywords: `**keywords** — App Store search keywords: comma-separated terms with NO spaces after commas (e.g. \`focus,screen time,productivity\`). Translate or adapt terms for the target locale search behavior. Do not repeat the app name. Must not exceed ${METADATA_FIELD_LIMITS.keywords} characters total.`,
  whatsNew: `**whatsNew** — Release notes for this version update. Preserve line breaks and list formatting. Must not exceed ${METADATA_FIELD_LIMITS.whatsNew} characters.`,
};

function sourceValueForField(
  source: MetadataPromptSource,
  field: MetadataTranslatableField
): string | undefined {
  switch (field) {
    case "name":
      return source.name;
    case "subtitle":
      return source.subtitle;
    case "description":
      return source.description;
    case "keywords":
      return source.keywords;
    case "whatsNew":
      return source.whatsNew;
  }
}

export function buildMetadataTranslationPrompt(
  template: string,
  source: MetadataPromptSource
): string {
  const fields = source.fieldsToTranslate;
  const isPartial = fields.length < (source.includeWhatsNew ? 5 : 4);

  const partialTaskNote = isPartial
    ? `\nTranslate ONLY these fields: ${fields.join(", ")}. Do NOT translate, modify, or include any other fields in your JSON response.`
    : "";

  const limitTableRows = fields
    .map(
      (field) =>
        `| ${field.padEnd(12)} | ${String(METADATA_FIELD_LIMITS[field]).padStart(18)} |`
    )
    .join("\n");

  const sourceSections = fields
    .map((field) => `### ${field}\n${emptyOr(sourceValueForField(source, field))}`)
    .join("\n\n");

  const fieldRules = fields
    .map((field, index) => `${index + 1}. ${FIELD_RULE_TEXT[field]}`)
    .join("\n\n");

  const outputJsonFields = fields
    .map((field) => `  "${field}": "..."`)
    .join(",\n");

  return template
    .replaceAll("{{SOURCE_LOCALE}}", source.sourceLocale)
    .replaceAll("{{TARGET_LOCALE}}", source.targetLocale)
    .replaceAll("{{SOURCE_LOCALE_LABEL}}", getLocalePromptLabel(source.sourceLocale))
    .replaceAll("{{TARGET_LOCALE_LABEL}}", getLocalePromptLabel(source.targetLocale))
    .replaceAll("{{PARTIAL_TASK_NOTE}}", partialTaskNote)
    .replaceAll("{{LIMIT_TABLE_ROWS}}", limitTableRows)
    .replaceAll("{{SOURCE_SECTIONS}}", sourceSections)
    .replaceAll("{{FIELD_RULES}}", fieldRules)
    .replaceAll("{{OUTPUT_JSON_FIELDS}}", outputJsonFields);
}

export interface MetadataLimitCorrectionSource {
  targetLocale: string;
  name: string;
  subtitle: string;
  description: string;
  keywords: string;
  whatsNew?: string;
  includeWhatsNew: boolean;
  overLimitFields: MetadataTranslatableField[];
}

function limitCorrectionFieldValue(
  source: MetadataLimitCorrectionSource,
  field: MetadataTranslatableField
): string {
  if (field === "whatsNew") return source.whatsNew ?? "";
  if (field === "keywords") return source.keywords;
  return source[field as "name" | "subtitle" | "description"];
}

export function buildMetadataLimitCorrectionPrompt(
  template: string,
  source: MetadataLimitCorrectionSource
): string {
  const whatsNewLimitRow = source.includeWhatsNew
    ? `| whatsNew     | ${METADATA_FIELD_LIMITS.whatsNew} |`
    : "";

  const allCurrentFields: MetadataTranslatableField[] = [
    "name",
    "subtitle",
    "description",
    "keywords",
  ];
  if (source.includeWhatsNew) allCurrentFields.push("whatsNew");

  const currentSections = allCurrentFields
    .map(
      (field) =>
        `### ${field}\n${emptyOr(limitCorrectionFieldValue(source, field))}`
    )
    .join("\n\n");

  const violations = source.overLimitFields
    .map((field) => {
      const value = limitCorrectionFieldValue(source, field);
      return `- **${field}**: ${value.length} characters (max ${METADATA_FIELD_LIMITS[field]}) — MUST be ≤ ${METADATA_FIELD_LIMITS[field]}`;
    })
    .join("\n");

  const outputFields = source.overLimitFields
    .map((field) => `  "${field}": "..."`)
    .join(",\n");

  return template
    .replaceAll("{{TARGET_LOCALE}}", source.targetLocale)
    .replaceAll("{{TARGET_LOCALE_LABEL}}", getLocalePromptLabel(source.targetLocale))
    .replaceAll("{{LIMIT_NAME}}", String(METADATA_FIELD_LIMITS.name))
    .replaceAll("{{LIMIT_SUBTITLE}}", String(METADATA_FIELD_LIMITS.subtitle))
    .replaceAll("{{LIMIT_DESCRIPTION}}", String(METADATA_FIELD_LIMITS.description))
    .replaceAll("{{LIMIT_KEYWORDS}}", String(METADATA_FIELD_LIMITS.keywords))
    .replaceAll("{{WHATSNEW_LIMIT_ROW}}", whatsNewLimitRow)
    .replaceAll("{{VIOLATIONS}}", violations)
    .replaceAll("{{CURRENT_SECTIONS}}", currentSections)
    .replaceAll("{{OUTPUT_JSON_FIELDS}}", outputFields);
}
