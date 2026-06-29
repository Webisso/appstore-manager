"use client";

import { useEffect, useMemo, useState } from "react";
import { IconClock, IconSparkles } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ImportProgressPanel,
  type ImportProgressItem,
  ElapsedTimer,
} from "@/components/import/import-progress-panel";
import {
  fetchLocalizationScreenshotsFromApi,
  getStoredCredentials,
  uploadScreenshotFromApi,
} from "@/lib/credentials";
import {
  generateScreenshotFromApi,
  getGeminiSettings,
  hasGeminiSettings,
} from "@/lib/gemini/settings";
import {
  IPHONE_UPLOAD_DIMENSIONS_LABEL,
  isIphoneScreenshotDisplayType,
} from "@/lib/apple/screenshot-dimensions";
import {
  base64ToPreviewUrl,
  resizeIphoneScreenshotFromApi,
} from "@/lib/image/client";
import {
  ScreenshotLightbox,
  type ScreenshotLightboxPreview,
} from "@/components/screenshot-lightbox";
import type {
  AppScreenshotSetDetail,
  ScreenshotDeviceCategory,
} from "@/lib/apple/types";

interface ScreenshotGenTask {
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

interface GeneratedScreenshot extends ScreenshotGenTask {
  imageBase64?: string;
  mimeType?: string;
  previewUrl?: string;
  outputWidth?: number;
  outputHeight?: number;
  error?: string;
}

interface CreateScreenshotsAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  targetLocale: string;
  targetVersionLocalizationId: string;
  sourceLocale: string;
  sourceVersionLocalizationId: string;
  deviceCategory: ScreenshotDeviceCategory;
  onUploaded: () => void;
}

type Phase = "confirm" | "generating" | "review" | "uploading" | "done";

function deviceTitle(category: ScreenshotDeviceCategory): string {
  if (category === "iphone") return "iPhone";
  if (category === "ipad") return "iPad";
  return "Other";
}

function buildTasks(
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

function groupGeneratedBySet(results: GeneratedScreenshot[]) {
  const groups = new Map<
    string,
    { displayLabel: string; items: GeneratedScreenshot[] }
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

function previewThumbnailStyle(width?: number, height?: number) {
  if (width && height) {
    return {
      aspectRatio: `${width} / ${height}`,
      height: "320px",
      width: "auto" as const,
    };
  }
  return { height: "320px", width: "auto" as const };
}

async function finalizeGeneratedImage(
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

export function CreateScreenshotsAiModal({
  open,
  onOpenChange,
  appId,
  targetLocale,
  targetVersionLocalizationId,
  sourceLocale,
  sourceVersionLocalizationId,
  deviceCategory,
  onUploaded,
}: CreateScreenshotsAiModalProps) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [customInstructions, setCustomInstructions] = useState("");
  const [sourceSets, setSourceSets] = useState<AppScreenshotSetDetail[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [items, setItems] = useState<ImportProgressItem[]>([]);
  const [generated, setGenerated] = useState<GeneratedScreenshot[]>([]);
  const [batchStartedAt, setBatchStartedAt] = useState<number | undefined>();
  const [batchElapsedMs, setBatchElapsedMs] = useState<number | undefined>();
  const [lightbox, setLightbox] = useState<ScreenshotLightboxPreview | null>(
    null
  );

  const deviceLabel = deviceTitle(deviceCategory);

  const previewTasks = useMemo(
    () => buildTasks(sourceSets, deviceCategory),
    [sourceSets, deviceCategory]
  );

  const previewSetCount = useMemo(() => {
    const types = new Set(previewTasks.map((task) => task.displayType));
    return types.size;
  }, [previewTasks]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setSourceLoading(true);

    const credentials = getStoredCredentials();
    if (!credentials) {
      setSourceSets([]);
      setSourceLoading(false);
      return;
    }

    void fetchLocalizationScreenshotsFromApi(
      credentials,
      appId,
      sourceVersionLocalizationId
    )
      .then((result) => {
        if (!cancelled) setSourceSets(result.screenshots.sets);
      })
      .catch(() => {
        if (!cancelled) setSourceSets([]);
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, appId, sourceVersionLocalizationId]);

  useEffect(() => {
    return () => {
      for (const item of generated) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [generated]);

  function resetModal() {
    for (const item of generated) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    setPhase("confirm");
    setCustomInstructions("");
    setSourceSets([]);
    setItems([]);
    setGenerated([]);
    setBatchStartedAt(undefined);
    setBatchElapsedMs(undefined);
    setLightbox(null);
  }

  function openGeneratedLightbox(item: GeneratedScreenshot) {
    if (!item.previewUrl) return;
    setLightbox({
      imageUrl: item.previewUrl,
      alt: `Generated ${item.displayLabel} ${item.index + 1}`,
      label: `${item.displayLabel} · #${item.index + 1}`,
      width: item.outputWidth,
      height: item.outputHeight,
    });
  }

  function handleProgressPreviewClick(item: ImportProgressItem) {
    if (!item.previewUrl) return;
    setLightbox({
      imageUrl: item.previewUrl,
      alt: item.previewAlt ?? item.label ?? "Screenshot",
      label: item.label,
      width: item.previewWidth,
      height: item.previewHeight,
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next && lightbox) {
      setLightbox(null);
      return;
    }
    if (!next && (phase === "generating" || phase === "uploading")) return;
    onOpenChange(next);
    if (!next) resetModal();
  }

  async function handleGenerate() {
    if (!hasGeminiSettings()) {
      toast.error("Configure Gemini API in Settings first.");
      return;
    }

    const gemini = getGeminiSettings();
    const apiKey = gemini?.apiKey;
    const imageModel = gemini?.imageModel;
    if (!apiKey || !imageModel) {
      toast.error("Gemini API key and image model are required.");
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Apple credentials not found.");
      return;
    }

    let tasks = previewTasks;
    if (tasks.length === 0) {
      try {
        const result = await fetchLocalizationScreenshotsFromApi(
          credentials,
          appId,
          sourceVersionLocalizationId
        );
        tasks = buildTasks(result.screenshots.sets, deviceCategory);
        setSourceSets(result.screenshots.sets);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load source screenshots."
        );
        return;
      }
    }

    if (tasks.length === 0) {
      toast.error(`No ${deviceLabel.toLowerCase()} screenshots in ${sourceLocale}.`);
      return;
    }

    const progressItems: ImportProgressItem[] = [
      {
        locale: "load-source",
        label: "Load source screenshots",
        status: "done",
        detail: `${tasks.length} screenshot(s) from ${sourceLocale}`,
      },
      ...tasks.map((task) => ({
        locale: task.id,
        label: `${task.displayLabel} · #${task.index + 1}`,
        status: "pending" as const,
        detail: `Position ${task.index + 1} of ${task.totalInSet}`,
      })),
    ];

    setItems(progressItems);
    const startedAt = Date.now();
    setBatchStartedAt(startedAt);
    setBatchElapsedMs(undefined);
    setPhase("generating");

    const results: GeneratedScreenshot[] = [];
    let failCount = 0;

    for (const task of tasks) {
      const taskStartedAt = Date.now();

      setItems((prev) =>
        prev.map((item) =>
          item.locale === task.id
            ? {
                ...item,
                status: "saving",
                startedAt: taskStartedAt,
                detail: `Generating with ${imageModel}`,
              }
            : item
        )
      );

      try {
        const result = await generateScreenshotFromApi({
          apiKey,
          model: imageModel,
          sourceImageUrl: task.sourceImageUrl,
          sourceLocale,
          targetLocale,
          displayType: task.displayType,
          displayLabel: task.displayLabel,
          screenshotIndex: task.index + 1,
          totalInSet: task.totalInSet,
          sourceWidth: task.sourceWidth,
          sourceHeight: task.sourceHeight,
          customInstructions: customInstructions.trim() || undefined,
        });

        if (isIphoneScreenshotDisplayType(task.displayType)) {
          setItems((prev) =>
            prev.map((item) =>
              item.locale === task.id
                ? {
                    ...item,
                    status: "correcting",
                    detail: `Resizing to ${IPHONE_UPLOAD_DIMENSIONS_LABEL}`,
                  }
                : item
            )
          );
        }

        const finalized = await finalizeGeneratedImage(
          task,
          result.imageBase64,
          result.mimeType
        );

        const generatedItem: GeneratedScreenshot = {
          ...task,
          imageBase64: finalized.imageBase64,
          mimeType: finalized.mimeType,
          previewUrl: finalized.previewUrl,
          outputWidth: finalized.outputWidth,
          outputHeight: finalized.outputHeight,
        };
        results.push(generatedItem);

        const elapsedMs = Date.now() - taskStartedAt;
        const doneDetail = isIphoneScreenshotDisplayType(task.displayType)
          ? `Ready at ${IPHONE_UPLOAD_DIMENSIONS_LABEL}`
          : "Generated successfully";

        setItems((prev) =>
          prev.map((item) =>
            item.locale === task.id
              ? {
                  ...item,
                  status: "done",
                  elapsedMs,
                  detail: doneDetail,
                  previewUrl: finalized.previewUrl,
                  previewAlt: `${task.displayLabel} #${task.index + 1}`,
                  previewWidth: finalized.outputWidth,
                  previewHeight: finalized.outputHeight,
                }
              : item
          )
        );
      } catch (error) {
        failCount++;
        const elapsedMs = Date.now() - taskStartedAt;
        const message =
          error instanceof Error ? error.message : "Generation failed";

        results.push({ ...task, error: message });

        setItems((prev) =>
          prev.map((item) =>
            item.locale === task.id
              ? {
                  ...item,
                  status: "error",
                  elapsedMs,
                  error: message,
                }
              : item
          )
        );
      }
    }

    setGenerated(results);
    setBatchElapsedMs(Date.now() - startedAt);

    const successCount = results.filter((item) => item.previewUrl).length;
    if (successCount === 0) {
      setPhase("done");
      toast.error("All screenshot generations failed.");
      return;
    }

    if (failCount > 0) {
      toast.warning(
        `${successCount} generated, ${failCount} failed. Review before uploading.`
      );
    }

    setPhase("review");
  }

  async function handleUpload() {
    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Apple credentials not found.");
      return;
    }

    const toUpload = generated.filter((item) => item.imageBase64 && item.mimeType);
    if (toUpload.length === 0) {
      toast.error("No generated screenshots to upload.");
      return;
    }

    const uploadItems: ImportProgressItem[] = [
      {
        locale: "prepare-upload",
        label: "Prepare upload",
        status: "done",
        detail: `${toUpload.length} screenshot(s) in order${
          deviceCategory === "iphone"
            ? ` · ${IPHONE_UPLOAD_DIMENSIONS_LABEL}`
            : ""
        }`,
      },
      ...toUpload.map((item) => ({
        locale: item.id,
        label: `${item.displayLabel} · #${item.index + 1}`,
        status: "pending" as const,
        detail: `Position ${item.index + 1} of ${item.totalInSet}`,
      })),
    ];

    setItems(uploadItems);
    const startedAt = Date.now();
    setBatchStartedAt(startedAt);
    setBatchElapsedMs(undefined);
    setPhase("uploading");

    let successCount = 0;
    let failCount = 0;

    for (const item of toUpload) {
      const taskStartedAt = Date.now();

      setItems((prev) =>
        prev.map((row) =>
          row.locale === item.id
            ? {
                ...row,
                status: "saving",
                startedAt: taskStartedAt,
                detail: "Uploading to App Store Connect",
              }
            : row
        )
      );

      try {
        await uploadScreenshotFromApi(credentials, appId, {
          versionLocalizationId: targetVersionLocalizationId,
          displayType: item.displayType,
          fileName:
            item.sourceFileName ??
            `${item.displayType.toLowerCase()}-${item.index + 1}`,
          imageBase64: item.imageBase64!,
          mimeType: item.mimeType!,
        });

        successCount++;
        const elapsedMs = Date.now() - taskStartedAt;
        setItems((prev) =>
          prev.map((row) =>
            row.locale === item.id
              ? {
                  ...row,
                  status: "done",
                  elapsedMs,
                  detail: isIphoneScreenshotDisplayType(item.displayType)
                    ? `Uploaded at ${IPHONE_UPLOAD_DIMENSIONS_LABEL}`
                    : "Uploaded to App Store Connect",
                  previewUrl: item.previewUrl,
                  previewAlt: `${item.displayLabel} #${item.index + 1}`,
                  previewWidth: item.outputWidth,
                  previewHeight: item.outputHeight,
                }
              : row
          )
        );
      } catch (error) {
        failCount++;
        const elapsedMs = Date.now() - taskStartedAt;
        const message =
          error instanceof Error ? error.message : "Upload failed";

        setItems((prev) =>
          prev.map((row) =>
            row.locale === item.id
              ? {
                  ...row,
                  status: "error",
                  elapsedMs,
                  error: message,
                }
              : row
          )
        );
      }
    }

    setBatchElapsedMs(Date.now() - startedAt);
    setPhase("done");

    if (successCount > 0) {
      onUploaded();
    }

    if (failCount === 0 && successCount > 0) {
      toast.success(
        `Uploaded ${successCount} ${deviceLabel.toLowerCase()} screenshot(s) to ${targetLocale}.`
      );
    } else if (successCount > 0) {
      toast.warning(`${successCount} uploaded, ${failCount} failed.`);
    } else {
      toast.error("Upload failed for all screenshots.");
    }
  }

  const groupedReview = groupGeneratedBySet(generated);
  const successfulCount = generated.filter((item) => item.previewUrl).length;
  const allGeneratedSuccessfully =
    generated.length > 0 && successfulCount === generated.length;
  const isBusy = phase === "generating" || phase === "uploading";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
          showCloseButton={!isBusy}
          onEscapeKeyDown={(event) => {
            if (lightbox) {
              event.preventDefault();
              setLightbox(null);
            }
          }}
        >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <IconSparkles className="size-4 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle>Create {deviceLabel} Screenshots with AI</DialogTitle>
                <DialogDescription>
                  Localize {deviceLabel.toLowerCase()} screenshots from{" "}
                  <code className="font-mono text-xs">{sourceLocale}</code> to{" "}
                  <code className="font-mono text-xs">{targetLocale}</code> using
                  Gemini.
                </DialogDescription>
              </div>
            </div>
            {(phase === "generating" ||
              phase === "uploading" ||
              phase === "done") &&
              batchStartedAt && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
                  <IconClock className="size-3.5 text-muted-foreground" />
                  <ElapsedTimer
                    startedAt={batchStartedAt}
                    active={isBusy}
                    elapsedMs={batchElapsedMs}
                    className="text-sm font-semibold text-foreground"
                  />
                </div>
              )}
          </div>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <p className="font-medium">How it works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-muted-foreground">
                <li>
                  Source {deviceLabel.toLowerCase()} screenshots are loaded from{" "}
                  {sourceLocale} in their original order.
                </li>
                <li>
                  Each screenshot is sent to your Gemini image model one at a
                  time — position #1 stays #1.
                </li>
                <li>You review all generated images before anything is uploaded.</li>
                <li>
                  On approval, screenshots upload to App Store Connect in the
                  same order.
                </li>
              </ol>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm">
              {sourceLoading ? (
                <p className="text-muted-foreground">Loading source preview…</p>
              ) : previewTasks.length === 0 ? (
                <p className="text-destructive">
                  No {deviceLabel.toLowerCase()} screenshots found in{" "}
                  {sourceLocale}.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Ready to generate{" "}
                  <strong className="text-foreground">
                    {previewTasks.length}
                  </strong>{" "}
                  screenshot(s) across{" "}
                  <strong className="text-foreground">{previewSetCount}</strong>{" "}
                  display size(s).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="screenshot-ai-instructions">
                Additional instructions (optional)
              </Label>
              <Textarea
                id="screenshot-ai-instructions"
                placeholder="e.g. Use formal tone, keep currency in USD, emphasize the premium tier…"
                value={customInstructions}
                onChange={(event) => setCustomInstructions(event.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                These instructions are appended to the AI prompt for every
                screenshot in this batch.
              </p>
            </div>
          </div>
        )}

        {(phase === "generating" || phase === "uploading") && (
          <ImportProgressPanel
            phase="importing"
            items={items}
            importingLabel={
              phase === "generating"
                ? "Generating screenshots…"
                : "Uploading to App Store Connect…"
            }
            doneLabel={
              phase === "generating" ? "Generation complete" : "Upload complete"
            }
            savedLabel={phase === "generating" ? "generated" : "uploaded"}
            savingStatusLabel={
              phase === "generating" ? "Generating…" : "Uploading…"
            }
            correctingStatusLabel="Resizing…"
            batchStartedAt={batchStartedAt}
            batchElapsedMs={batchElapsedMs}
            onItemPreviewClick={handleProgressPreviewClick}
          />
        )}

        {phase === "review" && (
          <div className="space-y-5 py-1">
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
              Review generated screenshots below. Order matches the source
              locale — screenshot #1 will upload as position #1.
              {deviceCategory === "iphone" && (
                <>
                  {" "}
                  iPhone screenshots are shown at{" "}
                  <strong className="text-foreground">
                    {IPHONE_UPLOAD_DIMENSIONS_LABEL}
                  </strong>{" "}
                  — click any image to zoom.
                </>
              )}
              {" "}Nothing is sent to App Store Connect until you approve.
            </div>

            {successfulCount < generated.length && (
              <p className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                {generated.length - successfulCount} screenshot(s) failed. All
                screenshots must generate successfully before uploading — order
                is preserved by regenerating the full batch.
              </p>
            )}

            {groupedReview.map((group) => (
              <div key={group.displayLabel} className="space-y-2">
                <p className="text-sm font-medium">{group.displayLabel}</p>
                <div className="overflow-x-auto pb-2">
                  <div className="flex flex-nowrap gap-3">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                      >
                        {item.previewUrl ? (
                          <button
                            type="button"
                            onClick={() => openGeneratedLightbox(item)}
                            className="block cursor-zoom-in transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Zoom ${item.displayLabel} #${item.index + 1}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.previewUrl}
                              alt={`Generated ${item.displayLabel} ${item.index + 1}`}
                              width={item.outputWidth}
                              height={item.outputHeight}
                              className="object-contain"
                              style={previewThumbnailStyle(
                                item.outputWidth,
                                item.outputHeight
                              )}
                            />
                          </button>
                        ) : (
                          <div className="flex h-64 w-40 flex-col items-center justify-center gap-1 px-2 text-center text-xs text-destructive">
                            <span>Failed</span>
                            {item.error && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.error}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="border-t border-border/60 px-2 py-1 text-center text-[10px] text-muted-foreground">
                          #{item.index + 1}
                          {item.outputWidth && item.outputHeight && (
                            <span className="block text-[9px] opacity-70">
                              {item.outputWidth}×{item.outputHeight}
                            </span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === "done" && (
          <ImportProgressPanel
            phase="done"
            items={items}
            doneLabel="Complete"
            savedLabel={
              items.some((item) => item.detail?.includes("Uploaded"))
                ? "uploaded"
                : "generated"
            }
            savingStatusLabel="Processing…"
            batchStartedAt={batchStartedAt}
            batchElapsedMs={batchElapsedMs}
            onItemPreviewClick={handleProgressPreviewClick}
          />
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleGenerate()}
                disabled={sourceLoading || previewTasks.length === 0}
              >
                <IconSparkles className="size-4" />
                Generate Screenshots
              </Button>
            </>
          )}

          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleUpload()}
                disabled={!allGeneratedSuccessfully}
              >
                Upload to App Store Connect
              </Button>
            </>
          )}

          {phase === "done" && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {lightbox && (
        <ScreenshotLightbox preview={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
