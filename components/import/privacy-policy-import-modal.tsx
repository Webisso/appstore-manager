"use client";

import { useMemo, useState } from "react";
import {
  IconDownload,
  IconShieldLock,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImportProgressPanel } from "@/components/import/import-progress-panel";
import { buildLocalizedUrl, previewLocalizedUrl } from "@/lib/import-url";
import {
  getStoredCredentials,
  importPrivacyPolicyFromApi,
} from "@/lib/credentials";
import type { LocalizationDetail } from "@/lib/apple/types";

type ImportItemStatus = "pending" | "saving" | "done" | "error" | "skipped";

interface ImportItem {
  locale: string;
  appInfoLocalizationId?: string;
  status: ImportItemStatus;
  url?: string;
  error?: string;
}

interface PrivacyPolicyImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  localizations: LocalizationDetail[];
  onImported: (updates: LocalizationDetail[]) => void;
}

export function PrivacyPolicyImportModal({
  open,
  onOpenChange,
  appId,
  localizations,
  onImported,
}: PrivacyPolicyImportModalProps) {
  const [baseUrl, setBaseUrl] = useState("");
  const [appendLocaleParam, setAppendLocaleParam] = useState(false);
  const [paramName, setParamName] = useState("lang");
  const [phase, setPhase] = useState<"form" | "importing" | "done">("form");
  const [items, setItems] = useState<ImportItem[]>([]);

  const sampleLocale =
    localizations.find((l) => l.locale)?.locale ?? "en-US";

  const previewUrl = useMemo(
    () =>
      previewLocalizedUrl(baseUrl, sampleLocale, {
        appendLocaleParam,
        paramName,
      }),
    [baseUrl, sampleLocale, appendLocaleParam, paramName]
  );

  function resetModal() {
    setPhase("form");
    setItems([]);
    setBaseUrl("");
    setAppendLocaleParam(false);
    setParamName("lang");
  }

  function handleOpenChange(next: boolean) {
    if (!next && phase === "importing") return;
    onOpenChange(next);
    if (!next) resetModal();
  }

  async function handleImport() {
    if (!baseUrl.trim()) {
      toast.error("Please enter a URL.");
      return;
    }

    if (appendLocaleParam && !paramName.trim()) {
      toast.error("Please enter a query parameter name.");
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Credentials not found. Please reconnect.");
      return;
    }

    const initialItems: ImportItem[] = localizations.map((loc) => ({
      locale: loc.locale,
      appInfoLocalizationId: loc.appInfoLocalizationId,
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

    for (let i = 0; i < localizations.length; i++) {
      const loc = localizations[i];
      const url = buildLocalizedUrl(baseUrl, loc.locale, {
        appendLocaleParam,
        paramName,
      });

      if (!loc.appInfoLocalizationId) {
        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? { ...item, status: "skipped", url }
              : item
          )
        );
        continue;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.locale === loc.locale
            ? { ...item, status: "saving", url }
            : item
        )
      );

      try {
        await importPrivacyPolicyFromApi(credentials, appId, {
          appInfoLocalizationId: loc.appInfoLocalizationId,
          locale: loc.locale,
          privacyPolicyUrl: url,
        });

        updates.push({ ...loc, privacyPolicyUrl: url });
        successCount++;

        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? { ...item, status: "done", url }
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
                  url,
                  error:
                    error instanceof Error ? error.message : "Save failed",
                }
              : item
          )
        );
      }
    }

    if (successCount > 0) {
      onImported(updates);
    }

    setPhase("done");

    if (failCount === 0 && successCount > 0) {
      toast.success(`Privacy policy imported to ${successCount} locale(s).`);
    } else if (successCount > 0) {
      toast.warning(
        `Imported ${successCount} locale(s), ${failCount} failed.`
      );
    } else {
      toast.error("Import failed for all locales.");
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
              <IconShieldLock className="size-4 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Import Privacy Policy</DialogTitle>
              <DialogDescription>
                Apply a URL to all {localizations.length} localizations at once.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="privacy-url">Privacy Policy URL</Label>
              <Input
                id="privacy-url"
                placeholder="https://example.com/privacy"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="lang-param-switch" className="text-sm">
                  Append language query param
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Adds{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                    ?{paramName || "param"}=tr-TR
                  </code>{" "}
                  per locale
                </p>
              </div>
              <Switch
                id="lang-param-switch"
                checked={appendLocaleParam}
                onCheckedChange={setAppendLocaleParam}
              />
            </div>

            {appendLocaleParam && (
              <div className="space-y-1.5">
                <Label htmlFor="param-name">Query parameter name</Label>
                <Input
                  id="param-name"
                  placeholder="lang"
                  value={paramName}
                  onChange={(e) => setParamName(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {previewUrl && (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Preview ({sampleLocale})
                </p>
                <p className="break-all font-mono text-[11px] text-foreground/80">
                  {previewUrl}
                </p>
              </div>
            )}
          </div>
        )}

        {(phase === "importing" || phase === "done") && (
          <ImportProgressPanel
            phase={phase}
            items={items.map((item) => ({
              locale: item.locale,
              status: item.status,
              detail: item.url,
              error: item.error,
            }))}
            importingLabel="Importing…"
            doneLabel="Import complete"
            savingStatusLabel="Saving…"
          />
        )}

        <DialogFooter>
          {phase === "form" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!baseUrl.trim()}>
                <IconDownload className="size-4" />
                Import & Save
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
