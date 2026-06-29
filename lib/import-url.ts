/**
 * Builds a URL for bulk import, optionally appending a locale query parameter.
 */
export function buildLocalizedUrl(
  baseUrl: string,
  locale: string,
  options: { appendLocaleParam: boolean; paramName: string }
): string {
  const trimmed = baseUrl.trim();
  if (!options.appendLocaleParam || !options.paramName.trim()) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    url.searchParams.set(options.paramName.trim(), locale);
    return url.toString();
  } catch {
    const separator = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${separator}${encodeURIComponent(options.paramName.trim())}=${encodeURIComponent(locale)}`;
  }
}

export function previewLocalizedUrl(
  baseUrl: string,
  sampleLocale: string,
  options: { appendLocaleParam: boolean; paramName: string }
): string {
  if (!baseUrl.trim()) return "";
  return buildLocalizedUrl(baseUrl, sampleLocale || "en-US", options);
}
