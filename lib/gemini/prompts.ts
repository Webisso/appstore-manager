import { readFile } from "fs/promises";
import path from "path";
import { METADATA_FIELD_LIMITS } from "@/lib/apple/metadata-limits";

let cachedMetadataPrompt: string | null = null;

export async function loadMetadataTranslationPrompt(): Promise<string> {
  if (!cachedMetadataPrompt) {
    cachedMetadataPrompt = await readFile(
      path.join(process.cwd(), "public/prompts/metadata-translation.txt"),
      "utf-8"
    );
  }
  return cachedMetadataPrompt;
}

export interface MetadataPromptSource {
  sourceLocale: string;
  targetLocale: string;
  name?: string;
  subtitle?: string;
  description?: string;
  whatsNew?: string;
  includeWhatsNew: boolean;
}

function emptyOr(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "(empty)";
}

export function buildMetadataTranslationPrompt(
  template: string,
  source: MetadataPromptSource
): string {
  const whatsNewLimitRow = source.includeWhatsNew
    ? `| whatsNew     | ${METADATA_FIELD_LIMITS.whatsNew} |`
    : "";

  const sourceWhatsNewSection = source.includeWhatsNew
    ? `\n### whatsNew\n${emptyOr(source.whatsNew)}`
    : "";

  const whatsNewRules = source.includeWhatsNew
    ? `4. **whatsNew** — Release notes for this version update. Preserve line breaks and list formatting. Must not exceed ${METADATA_FIELD_LIMITS.whatsNew} characters.`
    : "";

  const whatsNewJsonField = source.includeWhatsNew ? ',\n  "whatsNew": "..."' : "";

  return template
    .replaceAll("{{SOURCE_LOCALE}}", source.sourceLocale)
    .replaceAll("{{TARGET_LOCALE}}", source.targetLocale)
    .replaceAll("{{LIMIT_NAME}}", String(METADATA_FIELD_LIMITS.name))
    .replaceAll("{{LIMIT_SUBTITLE}}", String(METADATA_FIELD_LIMITS.subtitle))
    .replaceAll("{{LIMIT_DESCRIPTION}}", String(METADATA_FIELD_LIMITS.description))
    .replaceAll("{{WHATSNEW_LIMIT_ROW}}", whatsNewLimitRow)
    .replaceAll("{{SOURCE_NAME}}", emptyOr(source.name))
    .replaceAll("{{SOURCE_SUBTITLE}}", emptyOr(source.subtitle))
    .replaceAll("{{SOURCE_DESCRIPTION}}", emptyOr(source.description))
    .replaceAll("{{SOURCE_WHATSNEW_SECTION}}", sourceWhatsNewSection)
    .replaceAll("{{WHATSNEW_RULES}}", whatsNewRules)
    .replaceAll("{{WHATSNEW_JSON_FIELD}}", whatsNewJsonField);
}
