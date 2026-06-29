import type { LocalizationDetail } from "@/lib/apple/types";

export const LOCALIZATION_MATCH_FIELDS = [
  "name",
  "subtitle",
  "description",
  "keywords",
] as const;

export type LocalizationMatchField = (typeof LOCALIZATION_MATCH_FIELDS)[number];

export function normalizeLocaleTag(locale: string): string {
  return locale.replace(/_/g, "-").toLowerCase();
}

export function localeEquals(a: string, b: string): boolean {
  return normalizeLocaleTag(a) === normalizeLocaleTag(b);
}

/** Normalize text like the localization editor does before comparing. */
export function normalizeComparableText(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/**
 * Field matches source when equal, or target is empty while source has content
 * (App Store often omits name/subtitle on non-primary app-info localizations).
 */
export function translatableFieldMatchesSource(
  locValue: string | undefined,
  sourceValue: string | undefined
): boolean {
  const loc = normalizeComparableText(locValue);
  const source = normalizeComparableText(sourceValue);

  if (loc === source) return true;
  if (loc === "" && source !== "") return true;
  return false;
}

/**
 * Fields that still match the source (equal or empty/unset on target).
 */
export function getFieldsMatchingSource(
  loc: LocalizationDetail,
  source: LocalizationDetail
): LocalizationMatchField[] {
  return LOCALIZATION_MATCH_FIELDS.filter((field) =>
    translatableFieldMatchesSource(loc[field], source[field])
  );
}

/**
 * True when at least one of name, subtitle, description, or keywords still
 * matches the source — that field was not translated yet. whatsNew is ignored.
 */
export function localizationMatchesSource(
  loc: LocalizationDetail,
  source: LocalizationDetail
): boolean {
  return getFieldsMatchingSource(loc, source).length > 0;
}

export function findLocalizationByLocale(
  localizations: LocalizationDetail[],
  locale: string
): LocalizationDetail | undefined {
  return localizations.find((l) => localeEquals(l.locale, locale));
}

/** Resolve primary/source locale row even when API locale tags differ slightly. */
export function findSourceLocalization(
  localizations: LocalizationDetail[],
  primaryLocale?: string
): LocalizationDetail | undefined {
  if (!localizations.length) return undefined;
  if (!primaryLocale) return localizations[0];

  const exact = findLocalizationByLocale(localizations, primaryLocale);
  if (exact) return exact;

  const primaryTag = normalizeLocaleTag(primaryLocale);
  const primaryLang = primaryTag.split("-")[0];

  const sameLanguage = localizations.find((l) => {
    const tag = normalizeLocaleTag(l.locale);
    return tag === primaryLang || tag.startsWith(`${primaryLang}-`);
  });
  if (sameLanguage) return sameLanguage;

  return localizations[0];
}
