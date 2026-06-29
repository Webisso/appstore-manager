/** Human-readable locale label for AI prompts, e.g. "German (Germany, de-DE)". */
export function getLocalePromptLabel(locale: string): string {
  const tag = locale.includes("_") ? locale.replace(/_/g, "-") : locale;
  const parts = tag.split("-");
  const languageCode = parts[0]?.toLowerCase();
  if (!languageCode) return tag;

  try {
    const langNames = new Intl.DisplayNames(["en"], { type: "language" });
    const languageName = langNames.of(languageCode) ?? languageCode;

    const regionPart = parts[1];
    if (regionPart && /^[a-zA-Z]{2}$/.test(regionPart)) {
      const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
      const regionName =
        regionNames.of(regionPart.toUpperCase()) ?? regionPart.toUpperCase();
      return `${languageName} (${regionName}, ${tag})`;
    }

    return `${languageName} (${tag})`;
  } catch {
    return tag;
  }
}
