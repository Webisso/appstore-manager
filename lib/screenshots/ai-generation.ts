import { generateScreenshotFromApi } from "@/lib/gemini/settings";
import {
  isIphoneScreenshotDisplayType,
} from "@/lib/apple/screenshot-dimensions";
import {
  base64ToPreviewUrl,
  resizeIphoneScreenshotFromApi,
} from "@/lib/image/client";
import type {
  AppScreenshotSetDetail,
  ScreenshotDeviceCategory,
} from "@/lib/apple/types";

export interface ScreenshotGenTask {
  id: string;
  displayType: string;
  displayLabel: string;
  index: number;
  totalInSet: number;
  sourceImageUrl: string;
  sourceFileName?: string;
  sourceWidth: number;
  sourceHeight: number;
}

export interface GeneratedScreenshot extends ScreenshotGenTask {
  imageBase64?: string;
  mimeType?: string;
  previewUrl?: string;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
}

export interface BulkGeneratedScreenshot extends GeneratedScreenshot {
  locale: string;
  versionLocalizationId: string;
  deviceCategory: ScreenshotDeviceCategory;
  batchTaskId: string;
}

export type ScreenshotGenerationScope = "all" | "missing";

export function categoryHasScreenshots(
  sets: AppScreenshotSetDetail[],
  category: ScreenshotDeviceCategory
): boolean {
  return sets.some(
    (set) => set.deviceCategory === category && set.screenshots.length > 0
  );
}

export function buildTasks(
  sets: AppScreenshotSetDetail[],
  category: ScreenshotDeviceCategory
): ScreenshotGenTask[] {
  const tasks: ScreenshotGenTask[] = [];

  for (const set of sets) {
    if (set.deviceCategory !== category || set.screenshots.length === 0) {
      continue;
    }

    set.screenshots.forEach((shot, index) => {
      if (!shot.imageUrl || !shot.width || !shot.height) return;

      tasks.push({
        id: `${set.displayType}-${index}`,
        displayType: set.displayType,
        displayLabel: set.displayLabel,
        index,
        totalInSet: set.screenshots.length,
        sourceImageUrl: shot.imageUrl,
        sourceFileName: shot.fileName,
        sourceWidth: shot.width,
        sourceHeight: shot.height,
      });
    });
  }

  return tasks;
}

export function buildBatchTaskId(
  locale: string,
  task: Pick<ScreenshotGenTask, "displayType" | "index">
): string {
  return `${locale}-${task.displayType}-${task.index}`;
}

export function previewThumbnailStyle(width?: number, height?: number) {
  if (width && height) {
    return {
      aspectRatio: `${width} / ${height}`,
      height: "280px",
      width: "auto" as const,
    };
  }
  return { height: "280px", width: "auto" as const };
}

export function groupGeneratedBySet<T extends GeneratedScreenshot>(
  results: T[]
) {
  const groups = new Map<
    string,
    { displayLabel: string; items: T[] }
  >();

  for (const item of results) {
    const existing = groups.get(item.displayType);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.displayType, {
        displayLabel: item.displayLabel,
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

export function groupBulkByLocale(results: BulkGeneratedScreenshot[]) {
  const groups = new Map<string, BulkGeneratedScreenshot[]>();

  for (const item of results) {
    const existing = groups.get(item.locale);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.locale, [item]);
    }
  }

  return groups;
}

export async function finalizeGeneratedImage(
  task: ScreenshotGenTask,
  imageBase64: string,
  mimeType: string
): Promise<{
  imageBase64: string;
  mimeType: string;
  previewUrl: string;
  outputWidth: number;
  outputHeight: number;
}> {
  if (isIphoneScreenshotDisplayType(task.displayType)) {
    const resized = await resizeIphoneScreenshotFromApi({ imageBase64 });
    return {
      imageBase64: resized.imageBase64,
      mimeType: resized.mimeType,
      previewUrl: base64ToPreviewUrl(resized.imageBase64, resized.mimeType),
      outputWidth: resized.width,
      outputHeight: resized.height,
    };
  }

  return {
    imageBase64,
    mimeType,
    previewUrl: base64ToPreviewUrl(imageBase64, mimeType),
    outputWidth: task.sourceWidth,
    outputHeight: task.sourceHeight,
  };
}

export interface GenerateScreenshotOptions {
  apiKey: string;
  model: string;
  sourceLocale: string;
  targetLocale: string;
  customInstructions?: string;
}

export async function generateAndFinalizeScreenshot(
  task: ScreenshotGenTask,
  options: GenerateScreenshotOptions
): Promise<GeneratedScreenshot> {
  const result = await generateScreenshotFromApi({
    apiKey: options.apiKey,
    model: options.model,
    sourceImageUrl: task.sourceImageUrl,
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    displayType: task.displayType,
    displayLabel: task.displayLabel,
    screenshotIndex: task.index + 1,
    totalInSet: task.totalInSet,
    sourceWidth: task.sourceWidth,
    sourceHeight: task.sourceHeight,
    customInstructions: options.customInstructions,
  });

  const finalized = await finalizeGeneratedImage(
    task,
    result.imageBase64,
    result.mimeType
  );

  return {
    ...task,
    imageBase64: finalized.imageBase64,
    mimeType: finalized.mimeType,
    previewUrl: finalized.previewUrl,
    outputWidth: finalized.outputWidth,
    outputHeight: finalized.outputHeight,
  };
}

export function revokePreviewUrls(items: Array<{ previewUrl?: string }>) {
  for (const item of items) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
}
