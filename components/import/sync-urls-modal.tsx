"use client";

import { useMemo, useState } from "react";
import { IconLink } from "@tabler/icons-react";
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
import { ImportProgressPanel } from "@/components/import/import-progress-panel";
import {
  getStoredCredentials,
  importVersionUrlsFromApi,
} from "@/lib/credentials";
import { findSourceLocalization } from "@/lib/localization-match";
import type { LocalizationDetail } from "@/lib/apple/types";

interface SyncUrlsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  primaryLocale?: string;
  localizations: LocalizationDetail[];
  onSynced: (updates: LocalizationDetail[]) => void;
}

export function SyncUrlsModal({
  open,
  onOpenChange,
  appId,
  primaryLocale,
  localizations,
  onSynced,
}: SyncUrlsModalProps) {
  const [phase, setPhase] = useState<"confirm" | "importing" | "done">("confirm");
  const [items, setItems] = useState<
    import("@/components/import/import-progress-panel").ImportProgressItem[]
  >([]);

  const sourceLocalization = useMemo(
    () => findSourceLocalization(localizations, primaryLocale),
    [localizations, primaryLocale]
  );

  const supportUrl = sourceLocalization?.supportUrl?.trim() ?? "";
  const marketingUrl = sourceLocalization?.marketingUrl?.trim() ?? "";

  const targetLocalizations = useMemo(
    () => localizations.filter((loc) => loc.versionLocalizationId),
    [localizations]
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

  async function handleSync() {
    if (!supportUrl && !marketingUrl) {
      toast.error("Set Support URL or Marketing URL on the primary locale first.");
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Credentials not found. Please reconnect.");
      return;
    }

    if (targetLocalizations.length === 0) {
      toast.error("No version localizations found.");
      return;
    }

    const initialItems = targetLocalizations.map((loc) => ({
      locale: loc.locale,
      status: "pending" as const,
    }));

    setItems(initialItems);
    setPhase("importing");

    const updates: LocalizationDetail[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const loc of targetLocalizations) {
      setItems((prev) =>
        prev.map((item) =>
          item.locale === loc.locale
            ? { ...item, status: "saving", detail: "Updating URLs" }
            : item
        )
      );

      try {
        await importVersionUrlsFromApi(credentials, appId, {
          versionLocalizationId: loc.versionLocalizationId!,
          locale: loc.locale,
          supportUrl,
          marketingUrl,
        });

        updates.push({
          ...loc,
          supportUrl,
          marketingUrl,
        });
        successCount++;

        setItems((prev) =>
          prev.map((item) =>
            item.locale === loc.locale
              ? { ...item, status: "done", detail: "URLs updated" }
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
                    error instanceof Error ? error.message : "Update failed",
                }
              : item
          )
        );
      }
    }

    if (updates.length > 0) {
      onSynced(updates);
    }

    setPhase("done");

    if (failCount === 0 && successCount > 0) {
      toast.success(`Updated URLs for ${successCount} locale(s).`);
    } else if (successCount > 0) {
      toast.warning(`${successCount} updated, ${failCount} failed.`);
    } else {
      toast.error("Failed to update URLs for all locales.");
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
              <IconLink className="size-4 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle>Apply URLs to All Locales</DialogTitle>
              <DialogDescription>
                Copy Support URL and Marketing URL from{" "}
                <code className="font-mono text-xs">{primaryLocale}</code> to
                every locale.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="space-y-4 py-1">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Support URL
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {supportUrl || "Not set on primary locale"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Marketing URL
                </p>
                <p className="mt-1 break-all font-mono text-xs">
                  {marketingUrl || "Not set on primary locale"}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This will overwrite Support URL and Marketing URL on{" "}
              <strong className="text-foreground">
                {targetLocalizations.length}
              </strong>{" "}
              locale(s), including the primary locale.
            </p>
          </div>
        )}

        {(phase === "importing" || phase === "done") && (
          <ImportProgressPanel
            phase={phase === "importing" ? "importing" : "done"}
            items={items}
            importingLabel="Updating URLs…"
            doneLabel="Update complete"
            savedLabel="updated"
            savingStatusLabel="Saving…"
          />
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSync()}
                disabled={
                  (!supportUrl && !marketingUrl) ||
                  targetLocalizations.length === 0
                }
              >
                <IconLink className="size-4" />
                Apply to All Locales
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
