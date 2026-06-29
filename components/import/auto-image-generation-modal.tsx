"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconClock,
  IconDeviceIpad,
  IconDeviceMobile,
  IconSparkles,
} from "@tabler/icons-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  ImportProgressPanel,
  type ImportProgressItem,
  ElapsedTimer,
} from "@/components/import/import-progress-panel";
import {
  ScreenshotLightbox,
  type ScreenshotLightboxPreview,
} from "@/components/screenshot-lightbox";
import {
  fetchLocalizationScreenshotsFromApi,
  getStoredCredentials,
  uploadScreenshotFromApi,
} from "@/lib/credentials";
import { getGeminiSettings, hasGeminiSettings } from "@/lib/gemini/settings";
import { localeEquals } from "@/lib/localization-match";
import { IPHONE_UPLOAD_DIMENSIONS_LABEL } from "@/lib/apple/screenshot-dimensions";
import {
  buildBatchTaskId,
  buildTasks,
  categoryHasScreenshots,
  generateAndFinalizeScreenshot,
  groupBulkByLocale,
  groupGeneratedBySet,
  previewThumbnailStyle,
  revokePreviewUrls,
  type BulkGeneratedScreenshot,
  type ScreenshotGenerationScope,
} from "@/lib/screenshots/ai-generation";
import type {
  AppScreenshotSetDetail,
  LocalizationDetail,
  ScreenshotDeviceCategory,
} from "@/lib/apple/types";
import { cn } from "@/lib/utils";

interface LocaleWorkPlan {
  locale: string;
  versionLocalizationId: string;
  categories: ScreenshotDeviceCategory[];
}

interface AutoImageGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  primaryLocale?: string;
  localizations: LocalizationDetail[];
}

type Phase = "confirm" | "generating" | "review" | "uploading" | "done";

async function planLocaleWork(
  credentials: ReturnType<typeof getStoredCredentials>,
  appId: string,
  localizations: LocalizationDetail[],
  sourceLocale: string,
  sourceSets: AppScreenshotSetDetail[],
  options: {
    generateIphone: boolean;
    generateIpad: boolean;
    scope: ScreenshotGenerationScope;
  }
): Promise<LocaleWorkPlan[]> {
  if (!credentials) return [];

  const selectedCategories: ScreenshotDeviceCategory[] = [];
  if (options.generateIphone && categoryHasScreenshots(sourceSets, "iphone")) {
    selectedCategories.push("iphone");
  }
  if (options.generateIpad && categoryHasScreenshots(sourceSets, "ipad")) {
    selectedCategories.push("ipad");
  }

  if (selectedCategories.length === 0) return [];

  const targets = localizations.filter(
    (loc) =>
      loc.versionLocalizationId &&
      (!sourceLocale || !localeEquals(loc.locale, sourceLocale))
  );

  const work: LocaleWorkPlan[] = [];

  for (const loc of targets) {
    let categories = [...selectedCategories];

    if (options.scope === "missing") {
      const targetData = await fetchLocalizationScreenshotsFromApi(
        credentials,
        appId,
        loc.versionLocalizationId!
      );
      categories = selectedCategories.filter(
        (category) =>
          !categoryHasScreenshots(targetData.screenshots.sets, category)
      );
    }

    if (categories.length > 0) {
      work.push({
        locale: loc.locale,
        versionLocalizationId: loc.versionLocalizationId!,
        categories,
      });
    }
  }

  return work;
}

function estimateScreenshotCount(
  sourceSets: AppScreenshotSetDetail[],
  work: LocaleWorkPlan[]
): number {
  let total = 0;
  for (const item of work) {
    for (const category of item.categories) {
      total += buildTasks(sourceSets, category).length;
    }
  }
  return total;
}

export function AutoImageGenerationModal({
  open,
  onOpenChange,
  appId,
  primaryLocale,
  localizations,
}: AutoImageGenerationModalProps) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [generateIphone, setGenerateIphone] = useState(true);
  const [generateIpad, setGenerateIpad] = useState(false);
  const [scope, setScope] = useState<ScreenshotGenerationScope>("missing");
  const [customInstructions, setCustomInstructions] = useState("");
  const [sourceSets, setSourceSets] = useState<AppScreenshotSetDetail[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [workPlan, setWorkPlan] = useState<LocaleWorkPlan[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [items, setItems] = useState<ImportProgressItem[]>([]);
  const [generated, setGenerated] = useState<BulkGeneratedScreenshot[]>([]);
  const [batchStartedAt, setBatchStartedAt] = useState<number | undefined>();
  const [batchElapsedMs, setBatchElapsedMs] = useState<number | undefined>();
  const [lightbox, setLightbox] = useState<ScreenshotLightboxPreview | null>(
    null
  );

  const sourceLocale = primaryLocale ?? localizations[0]?.locale ?? "";
  const sourceVersionLocalizationId = localizations.find(
    (loc) => sourceLocale && localeEquals(loc.locale, sourceLocale)
  )?.versionLocalizationId;

  const estimatedCount = useMemo(
    () => estimateScreenshotCount(sourceSets, workPlan),
    [sourceSets, workPlan]
  );

  useEffect(() => {
    if (!open || !sourceVersionLocalizationId) return;

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
    if (!open || sourceLoading || !sourceSets.length) {
      setWorkPlan([]);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);

    const credentials = getStoredCredentials();
    if (!credentials || !sourceLocale) {
      setWorkPlan([]);
      setPlanLoading(false);
      return;
    }

    void planLocaleWork(
      credentials,
      appId,
      localizations,
      sourceLocale,
      sourceSets,
      { generateIphone, generateIpad, scope }
    )
      .then((plan) => {
        if (!cancelled) setWorkPlan(plan);
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    sourceLoading,
    sourceSets,
    generateIphone,
    generateIpad,
    scope,
    appId,
    localizations,
    sourceLocale,
  ]);

  useEffect(() => {
    return () => revokePreviewUrls(generated);
  }, [generated]);

  function resetModal() {
    revokePreviewUrls(generated);
    setPhase("confirm");
    setGenerateIphone(true);
    setGenerateIpad(false);
    setScope("missing");
    setCustomInstructions("");
    setSourceSets([]);
    setWorkPlan([]);
    setItems([]);
    setGenerated([]);
    setBatchStartedAt(undefined);
    setBatchElapsedMs(undefined);
    setLightbox(null);
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

  function openGeneratedLightbox(item: BulkGeneratedScreenshot) {
    if (!item.previewUrl) return;
    setLightbox({
      imageUrl: item.previewUrl,
      alt: `${item.locale} ${item.displayLabel} ${item.index + 1}`,
      label: `${item.locale} · ${item.displayLabel} · #${item.index + 1}`,
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

    if (!sourceVersionLocalizationId || !sourceLocale) {
      toast.error("Primary locale source not found.");
      return;
    }

    if (!generateIphone && !generateIpad) {
      toast.error("Select at least one device type.");
      return;
    }

    setPlanLoading(true);
    let plan: LocaleWorkPlan[];
    let setsForBatch = sourceSets;
    try {
      if (setsForBatch.length === 0) {
        const result = await fetchLocalizationScreenshotsFromApi(
          credentials,
          appId,
          sourceVersionLocalizationId
        );
        setsForBatch = result.screenshots.sets;
        setSourceSets(setsForBatch);
      }

      plan = await planLocaleWork(
        credentials,
        appId,
        localizations,
        sourceLocale,
        setsForBatch,
        { generateIphone, generateIpad, scope }
      );
      setWorkPlan(plan);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to plan generation."
      );
      setPlanLoading(false);
      return;
    } finally {
      setPlanLoading(false);
    }

    if (plan.length === 0) {
      toast.error("No locales match your selection.");
      return;
    }

    const batchTasks: Array<{
      batchTaskId: string;
      locale: string;
      versionLocalizationId: string;
      deviceCategory: ScreenshotDeviceCategory;
      task: ReturnType<typeof buildTasks>[number];
    }> = [];

    for (const work of plan) {
      for (const category of work.categories) {
        const tasks = buildTasks(setsForBatch, category);
        for (const task of tasks) {
          batchTasks.push({
            batchTaskId: buildBatchTaskId(work.locale, task),
            locale: work.locale,
            versionLocalizationId: work.versionLocalizationId,
            deviceCategory: category,
            task,
          });
        }
      }
    }

    if (batchTasks.length === 0) {
      toast.error(`No source screenshots found in ${sourceLocale}.`);
      return;
    }

    const progressItems: ImportProgressItem[] = [
      {
        locale: "plan",
        label: "Plan batch",
        status: "done",
        detail: `${batchTasks.length} screenshot(s) across ${plan.length} locale(s)`,
      },
      ...batchTasks.map(({ batchTaskId, locale, task }) => ({
        locale: batchTaskId,
        label: `${locale} · ${task.displayLabel} · #${task.index + 1}`,
        status: "pending" as const,
        detail: `Position ${task.index + 1} of ${task.totalInSet}`,
      })),
    ];

    setItems(progressItems);
    const startedAt = Date.now();
    setBatchStartedAt(startedAt);
    setBatchElapsedMs(undefined);
    setPhase("generating");

    const results: BulkGeneratedScreenshot[] = [];
    let failCount = 0;

    for (const batchTask of batchTasks) {
      const { batchTaskId, locale, versionLocalizationId, deviceCategory, task } =
        batchTask;
      const taskStartedAt = Date.now();

      setItems((prev) =>
        prev.map((item) =>
          item.locale === batchTaskId
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
        const generatedItem = await generateAndFinalizeScreenshot(task, {
          apiKey,
          model: imageModel,
          sourceLocale,
          targetLocale: locale,
          customInstructions: customInstructions.trim() || undefined,
        });

        const bulkItem: BulkGeneratedScreenshot = {
          ...generatedItem,
          locale,
          versionLocalizationId,
          deviceCategory,
          batchTaskId,
        };
        results.push(bulkItem);

        const elapsedMs = Date.now() - taskStartedAt;
        setItems((prev) =>
          prev.map((item) =>
            item.locale === batchTaskId
              ? {
                  ...item,
                  status: "done",
                  elapsedMs,
                  detail: generatedItem.outputWidth
                    ? `${generatedItem.outputWidth}×${generatedItem.outputHeight}`
                    : "Generated",
                  previewUrl: generatedItem.previewUrl,
                  previewAlt: `${locale} ${task.displayLabel} #${task.index + 1}`,
                  previewWidth: generatedItem.outputWidth,
                  previewHeight: generatedItem.outputHeight,
                }
              : item
          )
        );
      } catch (error) {
        failCount++;
        const elapsedMs = Date.now() - taskStartedAt;
        const message =
          error instanceof Error ? error.message : "Generation failed";

        results.push({
          ...task,
          locale,
          versionLocalizationId,
          deviceCategory,
          batchTaskId,
          error: message,
        });

        setItems((prev) =>
          prev.map((item) =>
            item.locale === batchTaskId
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

    const localeOrder = workPlan.map((work) => work.locale);

    const uploadItems: ImportProgressItem[] = [
      {
        locale: "prepare-upload",
        label: "Prepare upload",
        status: "done",
        detail: `${toUpload.length} screenshot(s) · ${localeOrder.length} locale(s)`,
      },
      ...toUpload.map((item) => ({
        locale: item.batchTaskId,
        label: `${item.locale} · ${item.displayLabel} · #${item.index + 1}`,
        status: "pending" as const,
        detail: `Upload to App Store Connect`,
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
          row.locale === item.batchTaskId
            ? {
                ...row,
                status: "saving",
                startedAt: taskStartedAt,
                detail: "Uploading…",
              }
            : row
        )
      );

      try {
        await uploadScreenshotFromApi(credentials, appId, {
          versionLocalizationId: item.versionLocalizationId,
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
            row.locale === item.batchTaskId
              ? {
                  ...row,
                  status: "done",
                  elapsedMs,
                  detail: "Uploaded",
                  previewUrl: item.previewUrl,
                  previewAlt: `${item.locale} ${item.displayLabel}`,
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
            row.locale === item.batchTaskId
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

    if (failCount === 0 && successCount > 0) {
      toast.success(`Uploaded ${successCount} screenshot(s) to App Store Connect.`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} uploaded, ${failCount} failed.`);
    } else {
      toast.error("Upload failed for all screenshots.");
    }
  }

  const groupedByLocale = groupBulkByLocale(generated);
  const localeOrder = workPlan.map((work) => work.locale);
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
                  <DialogTitle>Auto Image Generation</DialogTitle>
                  <DialogDescription>
                    Generate localized screenshots from{" "}
                    <code className="font-mono text-xs">{sourceLocale}</code> for
                    multiple locales using Gemini.
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
                    Screenshots are generated locale by locale, preserving order
                    within each set.
                  </li>
                  <li>You review all generated images before anything uploads.</li>
                  <li>
                    On approval, each locale uploads to App Store Connect
                    sequentially.
                  </li>
                </ol>
              </div>

              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Device types
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                  <div className="flex items-center justify-between gap-3 sm:justify-start">
                    <div className="flex items-center gap-2">
                      <IconDeviceMobile className="size-4 text-muted-foreground" />
                      <Label htmlFor="batch-iphone">iPhone</Label>
                    </div>
                    <Switch
                      id="batch-iphone"
                      checked={generateIphone}
                      onCheckedChange={setGenerateIphone}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-start">
                    <div className="flex items-center gap-2">
                      <IconDeviceIpad className="size-4 text-muted-foreground" />
                      <Label htmlFor="batch-ipad">iPad</Label>
                    </div>
                    <Switch
                      id="batch-ipad"
                      checked={generateIpad}
                      onCheckedChange={setGenerateIpad}
                    />
                  </div>
                </div>
                {generateIphone && (
                  <p className="text-[11px] text-muted-foreground">
                    iPhone uploads are resized to {IPHONE_UPLOAD_DIMENSIONS_LABEL}.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="missing-only" className="text-sm font-medium">
                    Only locales missing screenshots
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    When off, regenerates for all target locales regardless of
                    existing screenshots.
                  </p>
                </div>
                <Switch
                  id="missing-only"
                  checked={scope === "missing"}
                  onCheckedChange={(checked) =>
                    setScope(checked ? "missing" : "all")
                  }
                />
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm">
                {sourceLoading || planLoading ? (
                  <p className="text-muted-foreground">Calculating batch…</p>
                ) : !sourceVersionLocalizationId ? (
                  <p className="text-destructive">Primary locale not found.</p>
                ) : workPlan.length === 0 ? (
                  <p className="text-muted-foreground">
                    No locales match your current selection.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Ready to generate{" "}
                    <strong className="text-foreground">{estimatedCount}</strong>{" "}
                    screenshot(s) for{" "}
                    <strong className="text-foreground">{workPlan.length}</strong>{" "}
                    locale(s).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch-ai-instructions">
                  Additional instructions (optional)
                </Label>
                <Textarea
                  id="batch-ai-instructions"
                  placeholder="Applied to every screenshot in this batch…"
                  value={customInstructions}
                  onChange={(event) => setCustomInstructions(event.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
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
                phase === "generating"
                  ? "Generation complete"
                  : "Upload complete"
              }
              savedLabel={phase === "generating" ? "generated" : "uploaded"}
              savingStatusLabel={
                phase === "generating" ? "Generating…" : "Uploading…"
              }
              batchStartedAt={batchStartedAt}
              batchElapsedMs={batchElapsedMs}
              onItemPreviewClick={handleProgressPreviewClick}
            />
          )}

          {phase === "review" && (
            <div className="space-y-5 py-1">
              <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm text-muted-foreground">
                Review all generated screenshots. Click any image to zoom. Upload
                sends each locale to App Store Connect in order.
              </div>

              {successfulCount < generated.length && (
                <p className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                  {generated.length - successfulCount} screenshot(s) failed. All
                  must succeed before uploading.
                </p>
              )}

              {localeOrder.map((locale) => {
                const localeItems = groupedByLocale.get(locale) ?? [];
                if (localeItems.length === 0) return null;

                return (
                  <div
                    key={locale}
                    className="space-y-3 rounded-lg border border-border/60 p-3"
                  >
                    <p className="text-sm font-medium">{locale}</p>
                    {groupGeneratedBySet(localeItems).map((group) => (
                      <div key={`${locale}-${group.displayLabel}`} className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {group.displayLabel}
                        </p>
                        <div className="overflow-x-auto pb-2">
                          <div className="flex flex-nowrap gap-3">
                            {group.items.map((item) => (
                              <div
                                key={item.batchTaskId}
                                className={cn(
                                  "shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20",
                                  item.error && "border-destructive/40"
                                )}
                              >
                                {item.previewUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => openGeneratedLightbox(item)}
                                    className="block cursor-zoom-in transition hover:brightness-95"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={item.previewUrl}
                                      alt={`${locale} ${item.displayLabel}`}
                                      className="object-contain"
                                      style={previewThumbnailStyle(
                                        item.outputWidth,
                                        item.outputHeight
                                      )}
                                    />
                                  </button>
                                ) : (
                                  <div className="flex h-48 w-28 items-center justify-center px-2 text-center text-xs text-destructive">
                                    Failed
                                  </div>
                                )}
                                <p className="border-t border-border/60 px-2 py-1 text-center text-[10px] text-muted-foreground">
                                  #{item.index + 1}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {phase === "done" && (
            <ImportProgressPanel
              phase="done"
              items={items}
              doneLabel="Complete"
              savedLabel={
                items.some((item) => item.detail === "Uploaded")
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
                  disabled={
                    sourceLoading ||
                    planLoading ||
                    workPlan.length === 0 ||
                    (!generateIphone && !generateIpad)
                  }
                >
                  <IconSparkles className="size-4" />
                  Generate All
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
