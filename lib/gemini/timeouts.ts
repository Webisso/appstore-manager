/** Max wait for a single Gemini generateContent call (server → Google). */
export const GEMINI_REQUEST_TIMEOUT_MS = 90_000;

/** Max wait for client → /api/gemini/translate-metadata round trip. */
export const TRANSLATE_API_TIMEOUT_MS = 100_000;

/** Max wait for saving a localization to App Store Connect. */
export const SAVE_LOCALIZATION_TIMEOUT_MS = 60_000;

/** Max wait for fetching screenshots from App Store Connect. */
export const SCREENSHOTS_FETCH_TIMEOUT_MS = 90_000;

/** Max wait for a single Gemini image generation request. */
export const GEMINI_IMAGE_REQUEST_TIMEOUT_MS = 120_000;

/** Max wait for client → /api/gemini/generate-screenshot round trip. */
export const GENERATE_SCREENSHOT_API_TIMEOUT_MS = 130_000;

/** Max wait for uploading a single screenshot to App Store Connect. */
export const SCREENSHOT_UPLOAD_TIMEOUT_MS = 120_000;

/** Max total time per locale (translate + fix + save). */
export const LOCALE_PROCESS_TIMEOUT_MS = 180_000;
