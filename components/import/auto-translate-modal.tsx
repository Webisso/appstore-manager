"use client";

import { useMemo, useState } from "react";
import { IconLanguage } from "@tabler/icons-react";
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
import {
  ImportProgressPanel,
  type ImportProgressItem,
} from "@/components/import/import-progress-panel";
import {
  getStoredCredentials,
  saveLocalizationFromApi,
} from "@/lib/credentials";
import {
  getGeminiSettings,
  hasGeminiSettings,
  translateMetadataFromApi,
} from "@/lib/gemini/settings";
import type { LocalizationDetail } from "@/lib/apple/types";

interface TranslateItem extends ImportProgressItem {
  appInfoLocalizationId?: string;
  versionLocalizationId?: string;
}

interface AutoTranslateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  primaryLocale?: string;
  versionId?: string;
  canEditWhatsNew: boolean;
  localizations: LocalizationDetail[];
  onTranslated: (updates: LocalizationDetail[]) => void;
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

  const sourceLocale = primaryLocale ?? localizations[0]?.locale;
  const sourceLocalization = useMemo(
    () => localizations.find((l) => l.locale === sourceLocale),
    [localizations, sourceLocale]
  );

  const targetLocales = useMemo(
    () => localizations.filter((l) => l.locale !== sourceLocale),
    [localizations, sourceLocale]
  );

  function resetModal() {
    setPhase("confirm");
    setItems([]);
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

    if (targetLocales.length === 0) {
      toast.error("No other locales to translate.");
      return;
    }

    if (!hasGeminiSettings()) {
      toast.error("Configure Gemini API in Settings first.");
      return;
    }

    const gemini = getGeminiSettings();
    if (!gemini?.apiKey || !gemini.textModel) {
      toast.error("Gemini API key and text model are required.");
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Credentials not found. Please reconnect.");
      return;
    }

    const initialItems: TranslateItem[] = targetLocales.map((loc) => ({
      locale: loc.locale,
      appInfoLocalizationId: loc.appInfoLocalizationId,
      versionLocalizationId: loc.versionLocalizationId,
      status: loc.appInfoLocalizationId ? "pending" : "skipped",
      error: loc.appInfoLocalizationId
        ? undefined
        : "No app info localization ID",
    }));

    setItems(initialItems);
    setPhase("importing");

    const updates: LocalizationDetail[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const loc of targetLocales) {
      if (!loc.appInfoLocalizationId) {
        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale ? { ...item, status: "skipped" } : item
          )
        );
        continue;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.locale === loc.locale
            ? { ...item, status: "saving", detail: `From ${sourceLocale}` }
            : item
        )
      );

      try {
        const { translation } = await translateMetadataFromApi({
          apiKey: gemini.apiKey,
          model: gemini.textModel,
          sourceLocale,
          targetLocale: loc.locale,
          name: sourceLocalization.name,
          subtitle: sourceLocalization.subtitle,
          description: sourceLocalization.description,
          whatsNew: sourceLocalization.whatsNew,
          includeWhatsNew: canEditWhatsNew,
        });

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
            keywords: loc.keywords,
            privacyPolicyUrl: loc.privacyPolicyUrl,
            includeWhatsNew: canEditWhatsNew,
          }
        );

        updates.push(saved.localization);
        successCount++;

        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? {
                  ...item,
                  status: "done",
                  detail: translation.name || loc.locale,
                }
              : item
          )
        );
      } catch (error) {
        failCount++;
        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? {
                  ...item,
                  status: "error",
                  error:
                    error instanceof Error ? error.message : "Translation failed",
                }
              : item
          )
        );
      }
    }

    if (successCount > 0) {
      onTranslated(updates);
    }

    setPhase("done");

    if (failCount === 0 && successCount > 0) {
      toast.success(`Translated ${successCount} locale(s) from ${sourceLocale}.`);
    } else if (successCount > 0) {
      toast.warning(
        `Translated ${successCount} locale(s), ${failCount} failed.`
      );
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
        </DialogHeader>

        {phase === "confirm" && (
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <p className="font-medium">Are you sure?</p>
              <p className="mt-2 text-muted-foreground">
                This will translate and overwrite{" "}
                <strong className="text-foreground">name</strong>,{" "}
                <strong className="text-foreground">subtitle</strong>,{" "}
                <strong className="text-foreground">description</strong>
                {canEditWhatsNew && (
                  <>
                    , and{" "}
                    <strong className="text-foreground">what&apos;s new</strong>
                  </>
                )}{" "}
                for{" "}
                <strong className="text-foreground">
                  {targetLocales.length}
                </strong>{" "}
                locale(s), using{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {sourceLocale}
                </code>{" "}
                as the source language.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Privacy policy URL and keywords will not be changed.
              </p>
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
                disabled={targetLocales.length === 0 || !sourceLocalization}
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
