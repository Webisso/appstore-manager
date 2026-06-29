import type { MetadataTranslatableField } from "@/lib/apple/metadata-limits";
import type { LocalizationDetail } from "@/lib/apple/types";
import {
  LOCALIZATION_MATCH_FIELDS,
  translatableFieldMatchesSource,
} from "@/lib/localization-match";

export const ALL_COPY_FIELDS = [...LOCALIZATION_MATCH_FIELDS] as const;

export type CopyField = (typeof ALL_COPY_FIELDS)[number];

export function localizationToTranslationBase(
  loc: LocalizationDetail
): Record<MetadataTranslatableField, string> {
  return {
    name: loc.name ?? "",
    subtitle: loc.subtitle ?? "",
    description: loc.description ?? "",
    keywords: loc.keywords ?? "",
    whatsNew: loc.whatsNew ?? "",
  };
}

export function getAllFieldsToTranslate(includeWhatsNew: boolean): MetadataTranslatableField[] {
  const fields: MetadataTranslatableField[] = [...ALL_COPY_FIELDS];
  if (includeWhatsNew) fields.push("whatsNew");
  return fields;
}

/** Per-locale fields that still match source and need translation. */
export function getFieldsToTranslate(
  loc: LocalizationDetail,
  source: LocalizationDetail,
  includeWhatsNew: boolean
): MetadataTranslatableField[] {
  const fields: MetadataTranslatableField[] = LOCALIZATION_MATCH_FIELDS.filter(
    (field) => translatableFieldMatchesSource(loc[field], source[field])
  );

  if (
    includeWhatsNew &&
    translatableFieldMatchesSource(loc.whatsNew, source.whatsNew)
  ) {
    fields.push("whatsNew");
  }

  return fields;
}

export function isPartialTranslation(
  fieldsToTranslate: MetadataTranslatableField[],
  includeWhatsNew: boolean
): boolean {
  return fieldsToTranslate.length < getAllFieldsToTranslate(includeWhatsNew).length;
}

export function mergeTranslationFields(
  base: Record<MetadataTranslatableField, string>,
  parsed: Record<string, unknown>,
  fields: MetadataTranslatableField[]
): Record<MetadataTranslatableField, string> {
  const result = { ...base };

  for (const field of fields) {
    if (field in parsed) {
      result[field] = String(parsed[field] ?? "");
    }
  }

  return result;
}

export function translationResultToBase(
  translation: {
    name: string;
    subtitle: string;
    description: string;
    keywords: string;
    whatsNew?: string;
  }
): Record<MetadataTranslatableField, string> {
  return {
    name: translation.name,
    subtitle: translation.subtitle,
    description: translation.description,
    keywords: translation.keywords,
    whatsNew: translation.whatsNew ?? "",
  };
}
