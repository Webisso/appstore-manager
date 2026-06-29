import { readFile } from "fs/promises";
import path from "path";
import { getLocalePromptLabel } from "@/lib/locale-display";

let cachedPrompt: string | null = null;

export async function loadScreenshotLocalizationPrompt(): Promise<string> {
  if (!cachedPrompt) {
    cachedPrompt = await readFile(
      path.join(process.cwd(), "public/prompts/screenshot-localization.txt"),
      "utf-8"
    );
  }
  return cachedPrompt;
}

export interface ScreenshotPromptInput {
  sourceLocale: string;
  targetLocale: string;
  displayType: string;
  displayLabel: string;
  screenshotIndex: number;
  totalInSet: number;
  sourceWidth: number;
  sourceHeight: number;
  customInstructions?: string;
}

export function buildScreenshotLocalizationPrompt(
  template: string,
  input: ScreenshotPromptInput
): string {
  const custom =
    input.customInstructions?.trim() ||
    "(No additional instructions — follow the rules above.)";

  return template
    .replaceAll("{{SOURCE_LOCALE_LABEL}}", getLocalePromptLabel(input.sourceLocale))
    .replaceAll("{{TARGET_LOCALE_LABEL}}", getLocalePromptLabel(input.targetLocale))
    .replaceAll("{{DISPLAY_TYPE}}", input.displayType)
    .replaceAll("{{DISPLAY_LABEL}}", input.displayLabel)
    .replaceAll("{{SCREENSHOT_INDEX}}", String(input.screenshotIndex))
    .replaceAll("{{TOTAL_IN_SET}}", String(input.totalInSet))
    .replaceAll("{{SOURCE_WIDTH}}", String(input.sourceWidth))
    .replaceAll("{{SOURCE_HEIGHT}}", String(input.sourceHeight))
    .replaceAll("{{CUSTOM_INSTRUCTIONS}}", custom);
}
