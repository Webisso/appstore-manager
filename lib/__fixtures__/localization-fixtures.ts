import type { LocalizationDetail } from "@/lib/apple/types";

/** Typical merge: en-US has app-info name/subtitle + version description. */
export const enUsFull: LocalizationDetail = {
  locale: "en-US",
  appInfoLocalizationId: "ai-en",
  versionLocalizationId: "vl-en",
  name: "Frogoo: Screen Time & Focus",
  subtitle: "Focus better daily",
  description: "Line one\\nLine two",
  keywords: "focus,screen time,productivity",
};

/**
 * pt-PT often matches en-US in ASC UI but API only returns version fields;
 * name/subtitle are empty on app-info localization (inherits primary in ASC).
 */
export const ptPtVersionOnly: LocalizationDetail = {
  locale: "pt-PT",
  appInfoLocalizationId: "ai-pt",
  versionLocalizationId: "vl-pt",
  name: undefined,
  subtitle: undefined,
  description: "Line one\\nLine two",
};

/** pt-PT with explicit copy identical to en-US (all fields set in API). */
export const ptPtIdentical: LocalizationDetail = {
  locale: "pt-PT",
  appInfoLocalizationId: "ai-pt",
  versionLocalizationId: "vl-pt",
  name: "Frogoo: Screen Time & Focus",
  subtitle: "Focus better daily",
  description: "Line one\\nLine two",
};

/** pt-PT already translated name. */
export const ptPtTranslated: LocalizationDetail = {
  ...ptPtIdentical,
  name: "Frogoo: Tempo de Ecrã",
};

/** App 6766513379-style list: primary en-US + several locales with inherited empty app-info fields. */
export function buildFrogooLikeLocalizations(): LocalizationDetail[] {
  const description =
    "Frogoo helps you manage screen time and stay focused.";

  const enUS: LocalizationDetail = {
    locale: "en-US",
    appInfoLocalizationId: "1",
    versionLocalizationId: "1",
    name: "Frogoo: Screen Time & Focus",
    subtitle: "Focus & screen time",
    description,
    keywords: "focus,screen time,productivity",
  };

  const untranslatedLocales = [
    "pt-PT",
    "cs",
    "de-DE",
    "el",
    "fr-FR",
    "it",
    "ja",
    "ko",
    "es-ES",
  ];

  const others: LocalizationDetail[] = untranslatedLocales.map((locale, i) => ({
    locale,
    appInfoLocalizationId: `ai-${i}`,
    versionLocalizationId: `vl-${i}`,
    description,
    keywords: "focus,screen time,productivity",
  }));

  return [enUS, ...others];
}
