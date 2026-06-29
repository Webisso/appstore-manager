"use client";

import { useMemo, useState } from "react";
import { IconClock, IconLanguage } from "@tabler/icons-react";
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
import {
  ImportProgressPanel,
  type ImportProgressItem,
  ElapsedTimer,
} from "@/components/import/import-progress-panel";
import {
  getStoredCredentials,
  saveLocalizationFromApi,
} from "@/lib/credentials";
import {
  getGeminiSettings,
  hasGeminiSettings,
  correctMetadataLimitsFromApi,
  translateMetadataFromApi,
} from "@/lib/gemini/settings";
import { withTimeout } from "@/lib/async-timeout";
import { LOCALE_PROCESS_TIMEOUT_MS } from "@/lib/gemini/timeouts";
import {
  localizationMatchesSource,
  findSourceLocalization,
  localeEquals,
} from "@/lib/localization-match";
import {
  getAllFieldsToTranslate,
  getFieldsToTranslate,
  isPartialTranslation,
  localizationToTranslationBase,
  translationResultToBase,
} from "@/lib/gemini/copy-fields";
import type { MetadataTranslatableField } from "@/lib/apple/metadata-limits";
import type { LocalizationDetail } from "@/lib/apple/types";

interface TranslateItem extends ImportProgressItem {
  appInfoLocalizationId?: string;
  versionLocalizationId?: string;
}

export interface TranslateResultMeta {
  limitErrorLocales: string[];
}

interface AutoTranslateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  primaryLocale?: string;
  versionId?: string;
  canEditWhatsNew: boolean;
  localizations: LocalizationDetail[];
  onTranslated: (
    updates: LocalizationDetail[],
    meta?: TranslateResultMeta
  ) => void;
}

function applyTranslation(
  loc: LocalizationDetail,
  translation: {
    name: string;
    subtitle: string;
    description: string;
    keywords: string;
    whatsNew?: string;
  },
  fieldsUpdated: MetadataTranslatableField[]
): LocalizationDetail {
  const result = { ...loc };

  for (const field of fieldsUpdated) {
    if (field === "whatsNew") {
      result.whatsNew = translation.whatsNew;
    } else {
      result[field] = translation[field];
    }
  }

  return result;
}

export function AutoTranslateModal({
  open,
  onOpenChange,
  appId,
  primaryLocale,
  versionId,
  canEditWhatsNew,
  localizations,
  onTranslated,
}: AutoTranslateModalProps) {
  const [phase, setPhase] = useState<"confirm" | "importing" | "done">(
    "confirm"
  );
  const [items, setItems] = useState<TranslateItem[]>([]);
  const [batchStartedAt, setBatchStartedAt] = useState<number | undefined>();
  const [batchElapsedMs, setBatchElapsedMs] = useState<number | undefined>();
  const [onlyMatchingSource, setOnlyMatchingSource] = useState(false);

  const sourceLocale = primaryLocale ?? localizations[0]?.locale;
  const sourceLocalization = useMemo(
    () => findSourceLocalization(localizations, sourceLocale),
    [localizations, sourceLocale]
  );

  const targetLocales = useMemo(
    () =>
      localizations.filter(
        (l) => !sourceLocale || !localeEquals(l.locale, sourceLocale)
      ),
    [localizations, sourceLocale]
  );

  const matchingSourceLocales = useMemo(() => {
    if (!sourceLocalization) return [];
    return targetLocales.filter((loc) =>
      localizationMatchesSource(loc, sourceLocalization)
    );
  }, [targetLocales, sourceLocalization]);

  const translateCount = onlyMatchingSource
    ? matchingSourceLocales.length
    : targetLocales.length;

  function resetModal() {
    setPhase("confirm");
    setItems([]);
    setBatchStartedAt(undefined);
    setBatchElapsedMs(undefined);
    setOnlyMatchingSource(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && phase === "importing") return;
    onOpenChange(next);
    if (!next) resetModal();
  }

  async function handleTranslate() {
    if (!sourceLocale || !sourceLocalization) {
      toast.error("Primary locale source not found.");
      return;
    }

    if (translateCount === 0) {
      toast.error(
        onlyMatchingSource
          ? "No locales still matching the source language."
          : "No other locales to translate."
      );
      return;
    }

    if (!hasGeminiSettings()) {
      toast.error("Configure Gemini API in Settings first.");
      return;
    }

    const gemini = getGeminiSettings();
    const apiKey = gemini?.apiKey;
    const textModel = gemini?.textModel;
    if (!apiKey || !textModel) {
      toast.error("Gemini API key and text model are required.");
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Credentials not found. Please reconnect.");
      return;
    }

    const localesToTranslate = onlyMatchingSource
      ? matchingSourceLocales
      : targetLocales;

    const initialItems: TranslateItem[] = targetLocales.map((loc) => {
      if (!loc.appInfoLocalizationId) {
        return {
          locale: loc.locale,
          appInfoLocalizationId: loc.appInfoLocalizationId,
          versionLocalizationId: loc.versionLocalizationId,
          status: "skipped",
          error: "No app info localization ID",
        };
      }

      if (
        onlyMatchingSource &&
        !localizationMatchesSource(loc, sourceLocalization)
      ) {
        return {
          locale: loc.locale,
          appInfoLocalizationId: loc.appInfoLocalizationId,
          versionLocalizationId: loc.versionLocalizationId,
          status: "skipped",
          detail: "All fields translated",
        };
      }

      return {
        locale: loc.locale,
        appInfoLocalizationId: loc.appInfoLocalizationId,
        versionLocalizationId: loc.versionLocalizationId,
        status: "pending",
      };
    });

    setItems(initialItems);
    const startedAt = Date.now();
    setBatchStartedAt(startedAt);
    setBatchElapsedMs(undefined);
    setPhase("importing");

    const updates: LocalizationDetail[] = [];
    const limitErrorLocales: string[] = [];
    let successCount = 0;
    let warningCount = 0;
    let failCount = 0;

    for (const loc of localesToTranslate) {
      if (!loc.appInfoLocalizationId) {
        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? { ...item, status: "skipped", elapsedMs: 0 }
              : item
          )
        );
        continue;
      }

      const localeStartedAt = Date.now();
      const fieldsToTranslate = onlyMatchingSource
        ? getFieldsToTranslate(loc, sourceLocalization, canEditWhatsNew)
        : getAllFieldsToTranslate(canEditWhatsNew);
      const translationBase = localizationToTranslationBase(loc);
      const progressDetail =
        onlyMatchingSource && isPartialTranslation(fieldsToTranslate, canEditWhatsNew)
          ? `Fields: ${fieldsToTranslate.join(", ")}`
          : `From ${sourceLocale}`;

      setItems((prev) =>
        prev.map((item) =>
          item.locale === loc.locale
            ? {
                ...item,
                status: "saving",
                startedAt: localeStartedAt,
                detail: progressDetail,
              }
            : item
        )
      );

      try {
        await withTimeout(
          (async () => {
            const { translation: initialTranslation, overLimitFields } =
              await translateMetadataFromApi({
                apiKey,
                model: textModel,
                sourceLocale,
                targetLocale: loc.locale,
                name: sourceLocalization.name,
                subtitle: sourceLocalization.subtitle,
                description: sourceLocalization.description,
                keywords: sourceLocalization.keywords,
                whatsNew: sourceLocalization.whatsNew,
                includeWhatsNew: canEditWhatsNew,
                fieldsToTranslate,
                translationBase,
              });

            let translation = initialTranslation;
            let limitCorrectedFields: string[] = [];

            if (overLimitFields && overLimitFields.length > 0) {
              limitCorrectedFields = overLimitFields;

              setItems((prev) =>
                prev.map((item) =>
                  item.locale === loc.locale
                    ? {
                        ...item,
                        status: "correcting",
                        detail: `Over limit: ${overLimitFields.join(", ")}`,
                      }
                    : item
                )
              );

              const corrected = await correctMetadataLimitsFromApi({
                apiKey,
                model: textModel,
                targetLocale: loc.locale,
                translation: initialTranslation,
                overLimitFields,
                includeWhatsNew: canEditWhatsNew,
                translationBase: translationResultToBase(initialTranslation),
              });

              translation = corrected.translation;

              if (
                corrected.overLimitFields &&
                corrected.overLimitFields.length > 0
              ) {
                const merged = applyTranslation(
                  loc,
                  translation,
                  fieldsToTranslate
                );
                let savedLocalization = merged;

                try {
                  const saved = await saveLocalizationFromApi(
                    credentials,
                    appId,
                    versionId,
                    {
                      locale: loc.locale,
                      appInfoLocalizationId: loc.appInfoLocalizationId,
                      versionLocalizationId: loc.versionLocalizationId,
                      name: merged.name,
                      subtitle: merged.subtitle,
                      description: merged.description,
                      whatsNew: merged.whatsNew,
                      keywords: merged.keywords,
                      privacyPolicyUrl: loc.privacyPolicyUrl,
                      includeWhatsNew: canEditWhatsNew,
                    }
                  );
                  savedLocalization = saved.localization;
                } catch {
                  // Keep local translation for manual editing.
                }

                updates.push(savedLocalization);
                limitErrorLocales.push(loc.locale);
                warningCount++;

                const elapsedMs = Date.now() - localeStartedAt;
                const overFields = corrected.overLimitFields.join(", ");

                setItems((prev) =>
                  prev.map((item) =>
                    item.locale === loc.locale
                      ? {
                          ...item,
                          status: "warning",
                          elapsedMs,
                          detail: merged.name || loc.locale,
                          limitCorrectedFields:
                            limitCorrectedFields.length > 0
                              ? limitCorrectedFields
                              : undefined,
                          error: `Still over limit: ${overFields}. Written to editor — shorten manually.`,
                        }
                      : item
                  )
                );
                return;
              }
            }

            const saved = await saveLocalizationFromApi(
              credentials,
              appId,
              versionId,
              {
                locale: loc.locale,
                appInfoLocalizationId: loc.appInfoLocalizationId,
                versionLocalizationId: loc.versionLocalizationId,
                name: translation.name,
                subtitle: translation.subtitle,
                description: translation.description,
                whatsNew: translation.whatsNew,
                keywords: translation.keywords,
                privacyPolicyUrl: loc.privacyPolicyUrl,
                includeWhatsNew: canEditWhatsNew,
              }
            );

            updates.push(saved.localization);
            successCount++;

            const elapsedMs = Date.now() - localeStartedAt;

            setItems((prev) =>
              prev.map((item) =>
                item.locale === loc.locale
                  ? {
                      ...item,
                      status: "done",
                      elapsedMs,
                      detail: translation.name || loc.locale,
                      limitCorrectedFields:
                        limitCorrectedFields.length > 0
                          ? limitCorrectedFields
                          : undefined,
                    }
                  : item
              )
            );
          })(),
          LOCALE_PROCESS_TIMEOUT_MS,
          `${loc.locale}: timed out after ${LOCALE_PROCESS_TIMEOUT_MS / 1000}s`
        );
      } catch (error) {
        failCount++;
        const elapsedMs = Date.now() - localeStartedAt;

        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? {
                  ...item,
                  status: "error",
                  elapsedMs,
                  error:
                    error instanceof Error ? error.message : "Translation failed",
                }
              : item
          )
        );
      }
    }

    setBatchElapsedMs(Date.now() - startedAt);

    if (updates.length > 0) {
      onTranslated(updates, { limitErrorLocales });
    }

    setPhase("done");

    if (failCount === 0 && warningCount === 0 && successCount > 0) {
      toast.success(`Translated ${successCount} locale(s) from ${sourceLocale}.`);
    } else if (successCount > 0 || warningCount > 0) {
      const parts: string[] = [];
      if (successCount > 0) parts.push(`${successCount} translated`);
      if (warningCount > 0)
        parts.push(`${warningCount} need manual limit fix`);
      if (failCount > 0) parts.push(`${failCount} failed`);
      toast.warning(parts.join(", ") + ".");
    } else {
      toast.error("Translation failed for all locales.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={phase !== "importing"}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                <IconLanguage className="size-4 text-muted-foreground" />
              </div>
              <div>
                <DialogTitle>Auto Translate</DialogTitle>
                <DialogDescription>
                  Translate App Store metadata using Gemini AI.
                </DialogDescription>
              </div>
            </div>
            {(phase === "importing" || phase === "done") && batchStartedAt && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
                <IconClock className="size-3.5 text-muted-foreground" />
                <ElapsedTimer
                  startedAt={batchStartedAt}
                  active={phase === "importing"}
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
              <p className="font-medium">Are you sure?</p>
              <p className="mt-2 text-muted-foreground">
                This will translate and overwrite{" "}
                <strong className="text-foreground">name</strong>,{" "}
                <strong className="text-foreground">subtitle</strong>,{" "}
                <strong className="text-foreground">description</strong>,{" "}
                <strong className="text-foreground">keywords</strong>
                {canEditWhatsNew && (
                  <>
                    , and{" "}
                    <strong className="text-foreground">what&apos;s new</strong>
                  </>
                )}{" "}
                for{" "}
                <strong className="text-foreground">{translateCount}</strong>{" "}
                locale(s), using{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {sourceLocale}
                </code>{" "}
                as the source language.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Privacy policy URL will not be changed.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
              <div className="space-y-0.5">
                <Label
                  htmlFor="only-matching-source"
                  className="text-sm font-medium"
                >
                  Only locales matching source
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Include locales where any field still matches{" "}
                  <code className="font-mono">{sourceLocale}</code>. Only
                  untranslated fields are sent to AI (e.g. keywords only if
                  name is already translated).{" "}
                  {matchingSourceLocales.length} locale(s) have pending fields.
                </p>
              </div>
              <Switch
                id="only-matching-source"
                checked={onlyMatchingSource}
                onCheckedChange={setOnlyMatchingSource}
              />
            </div>

            {sourceLocalization && (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Source preview ({sourceLocale})
                </p>
                <p className="text-xs font-medium">
                  {sourceLocalization.name || "—"}
                </p>
                {sourceLocalization.subtitle && (
                  <p className="text-[11px] text-muted-foreground">
                    {sourceLocalization.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(phase === "importing" || phase === "done") && (
          <ImportProgressPanel
            phase={phase}
            items={items}
            importingLabel="Translating…"
            doneLabel="Translation complete"
            savedLabel="translated"
            savingStatusLabel="Translating…"
            correctingStatusLabel="Fixing limits…"
            batchStartedAt={batchStartedAt}
            batchElapsedMs={batchElapsedMs}
          />
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleTranslate}
                disabled={translateCount === 0 || !sourceLocalization}
              >
                <IconLanguage className="size-4" />
                Translate & Save
              </Button>
            </>
          )}
          {phase === "done" && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
