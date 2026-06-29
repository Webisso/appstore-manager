"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconFileText, IconLink, IconPhoto, IconWorld } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LocalizationEditor } from "@/components/localization-editor";
import { LocalizationScreenshots } from "@/components/localization-screenshots";
import { ImportToolbar } from "@/components/import/import-toolbar";
import { PrivacyPolicyImportModal } from "@/components/import/privacy-policy-import-modal";
import { AutoTranslateModal } from "@/components/import/auto-translate-modal";
import { AutoImageGenerationModal } from "@/components/import/auto-image-generation-modal";
import { SyncUrlsModal } from "@/components/import/sync-urls-modal";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { AppDetail, LocalizationDetail } from "@/lib/apple/types";

interface AppDetailViewProps {
  app: AppDetail;
  appId: string;
  onLocalizationSaved: (updated: LocalizationDetail) => void;
}

function MetadataField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div
        className={cn(
          "rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm",
          mono && "font-mono text-xs",
          !value && "text-muted-foreground italic"
        )}
      >
        {value || "Not set"}
      </div>
    </div>
  );
}

function LocaleBadge({
  locale,
  isActive,
  isPrimary,
  isDirty,
  hasLimitError,
  onClick,
}: {
  locale: string;
  isActive: boolean;
  isPrimary: boolean;
  isDirty: boolean;
  hasLimitError?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        isActive
          ? hasLimitError
            ? "border-orange-500 bg-orange-500 text-white shadow-sm"
            : "border-foreground bg-foreground text-background shadow-sm"
          : hasLimitError
            ? "border-orange-500/60 bg-orange-500/10 text-orange-800 hover:border-orange-500/80 hover:bg-orange-500/15 dark:text-orange-300"
            : "border-border/70 bg-background text-muted-foreground hover:border-foreground/25 hover:bg-muted/50 hover:text-foreground",
        isDirty &&
          !isActive &&
          !hasLimitError &&
          "border-amber-500/50 text-amber-700 dark:text-amber-400"
      )}
    >
      {locale}
      {hasLimitError && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-orange-500",
            isActive && "bg-orange-100"
          )}
        />
      )}
      {isDirty && !hasLimitError && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-amber-500",
            isActive && "bg-amber-300"
          )}
        />
      )}
      {isPrimary && !isDirty && !hasLimitError && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            isActive ? "bg-background/70" : "bg-primary"
          )}
        />
      )}
    </button>
  );
}

export function AppDetailView({
  app,
  appId,
  onLocalizationSaved,
}: AppDetailViewProps) {
  const [selectedLocale, setSelectedLocale] = useState(
    () =>
      app.localizations.find((loc) => loc.locale === app.primaryLocale)
        ?.locale ??
      app.localizations[0]?.locale ??
      ""
  );
  const [dirtyLocales, setDirtyLocales] = useState<Set<string>>(new Set());
  const [limitErrorLocales, setLimitErrorLocales] = useState<Set<string>>(
    new Set()
  );
  const [privacyImportOpen, setPrivacyImportOpen] = useState(false);
  const [autoTranslateOpen, setAutoTranslateOpen] = useState(false);
  const [autoImageGenerationOpen, setAutoImageGenerationOpen] = useState(false);
  const [syncUrlsOpen, setSyncUrlsOpen] = useState(false);
  const [localizationTab, setLocalizationTab] = useState<"text" | "screenshots">(
    "text"
  );

  const handleBulkImported = useCallback(
    (updates: LocalizationDetail[]) => {
      for (const updated of updates) {
        onLocalizationSaved(updated);
        setDirtyLocales((prev) => {
          const next = new Set(prev);
          next.delete(updated.locale);
          return next;
        });
      }
    },
    [onLocalizationSaved]
  );

  const handleUrlsSynced = useCallback(
    (updates: LocalizationDetail[]) => {
      for (const updated of updates) {
        onLocalizationSaved(updated);
        setDirtyLocales((prev) => {
          const next = new Set(prev);
          next.delete(updated.locale);
          return next;
        });
      }
    },
    [onLocalizationSaved]
  );

  const handleBulkTranslated = useCallback(
    (
      updates: LocalizationDetail[],
      meta?: { limitErrorLocales?: string[] }
    ) => {
      const limitErrors = new Set(meta?.limitErrorLocales ?? []);

      for (const updated of updates) {
        onLocalizationSaved(updated);

        if (limitErrors.has(updated.locale)) {
          setLimitErrorLocales((prev) => new Set(prev).add(updated.locale));
          setDirtyLocales((prev) => new Set(prev).add(updated.locale));
        } else {
          setLimitErrorLocales((prev) => {
            const next = new Set(prev);
            next.delete(updated.locale);
            return next;
          });
          setDirtyLocales((prev) => {
            const next = new Set(prev);
            next.delete(updated.locale);
            return next;
          });
        }
      }
    },
    [onLocalizationSaved]
  );

  const handleDirtyChange = useCallback((locale: string, dirty: boolean) => {
    setDirtyLocales((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(locale);
      else next.delete(locale);
      return next;
    });
  }, []);

  const handleSaved = useCallback(
    (updated: LocalizationDetail) => {
      onLocalizationSaved(updated);
      setDirtyLocales((prev) => {
        const next = new Set(prev);
        next.delete(updated.locale);
        return next;
      });
      setLimitErrorLocales((prev) => {
        const next = new Set(prev);
        next.delete(updated.locale);
        return next;
      });
    },
    [onLocalizationSaved]
  );

  const activeLocalization = useMemo(() => {
    const selected = app.localizations.find(
      (loc) => loc.locale === selectedLocale
    );
    return selected ?? app.localizations[0];
  }, [app.localizations, selectedLocale]);

  function handleLocaleSelect(locale: string) {
    if (
      selectedLocale &&
      dirtyLocales.has(selectedLocale) &&
      locale !== selectedLocale
    ) {
      const confirmed = window.confirm(
        "You have unsaved changes for this locale. Switch anyway?"
      );
      if (!confirmed) return;
    }
    setSelectedLocale(locale);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/apps"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="size-3.5" />
          Back to apps
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{app.name}</h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {app.bundleId}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {app.primaryLocale && (
              <Badge variant="outline">{app.primaryLocale}</Badge>
            )}
            {app.version && (
              <Badge variant="secondary">v{app.version.versionString}</Badge>
            )}
            {app.version?.appStoreState && (
              <Badge variant="outline">{app.version.appStoreState}</Badge>
            )}
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">App Information</CardTitle>
          <CardDescription>General app details from App Store Connect</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <MetadataField label="SKU" value={app.sku} mono />
          <MetadataField label="Bundle ID" value={app.bundleId} mono />
          <MetadataField label="Primary Locale" value={app.primaryLocale} />
          <MetadataField
            label="Latest Version"
            value={app.version?.versionString}
          />
        </CardContent>
      </Card>

      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <IconWorld className="size-4 text-muted-foreground" />
            <h2 className="text-base font-medium">Localizations</h2>
            <Badge variant="secondary" className="font-normal">
              {app.localizations.length}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSyncUrlsOpen(true)}
              disabled={!app.primaryLocale}
            >
              <IconLink className="size-3.5" />
              Apply URLs to All
            </Button>
            <ImportToolbar
              onPrivacyPolicyImport={() => setPrivacyImportOpen(true)}
              onAutoTranslate={() => setAutoTranslateOpen(true)}
              onAutoImageGeneration={() => setAutoImageGenerationOpen(true)}
            />
          </div>
        </div>

        {app.localizations.length === 0 ? (
          <Card className="border-border/60 border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No localizations found.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap gap-2">
                {app.localizations.map((loc) => (
                  <LocaleBadge
                    key={loc.locale}
                    locale={loc.locale}
                    isActive={activeLocalization?.locale === loc.locale}
                    isPrimary={loc.locale === app.primaryLocale}
                    isDirty={dirtyLocales.has(loc.locale)}
                    hasLimitError={limitErrorLocales.has(loc.locale)}
                    onClick={() => handleLocaleSelect(loc.locale)}
                  />
                ))}
              </div>
            </div>

            {activeLocalization && (
              <Tabs
                value={localizationTab}
                onValueChange={(value) =>
                  setLocalizationTab(value as "text" | "screenshots")
                }
                className="w-full"
              >
                <TabsList className="mb-4 h-auto w-full justify-start gap-1 bg-muted/40 p-1 sm:w-fit">
                  <TabsTrigger
                    value="text"
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-5"
                  >
                    <IconFileText className="size-4" />
                    Text
                  </TabsTrigger>
                  <TabsTrigger
                    value="screenshots"
                    className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-5"
                  >
                    <IconPhoto className="size-4" />
                    Screenshots
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-0">
                  <LocalizationEditor
                    key={`${activeLocalization.locale}-${activeLocalization.appInfoLocalizationId}-${activeLocalization.versionLocalizationId}`}
                    appId={appId}
                    versionId={app.version?.id}
                    canEditWhatsNew={app.version?.canEditWhatsNew ?? false}
                    localization={activeLocalization}
                    onSaved={handleSaved}
                    onDirtyChange={handleDirtyChange}
                  />
                </TabsContent>

                <TabsContent value="screenshots" className="mt-0">
                  <LocalizationScreenshots
                    key={`${activeLocalization.locale}-${activeLocalization.versionLocalizationId}-screenshots`}
                    appId={appId}
                    locale={activeLocalization.locale}
                    versionLocalizationId={
                      activeLocalization.versionLocalizationId
                    }
                    primaryLocale={app.primaryLocale}
                    sourceVersionLocalizationId={
                      app.localizations.find(
                        (loc) => loc.locale === app.primaryLocale
                      )?.versionLocalizationId
                    }
                  />
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </div>

      <PrivacyPolicyImportModal
        open={privacyImportOpen}
        onOpenChange={setPrivacyImportOpen}
        appId={appId}
        localizations={app.localizations}
        onImported={handleBulkImported}
      />

      <AutoTranslateModal
        open={autoTranslateOpen}
        onOpenChange={setAutoTranslateOpen}
        appId={appId}
        primaryLocale={app.primaryLocale}
        versionId={app.version?.id}
        canEditWhatsNew={app.version?.canEditWhatsNew ?? false}
        localizations={app.localizations}
        onTranslated={handleBulkTranslated}
      />

      <AutoImageGenerationModal
        open={autoImageGenerationOpen}
        onOpenChange={setAutoImageGenerationOpen}
        appId={appId}
        primaryLocale={app.primaryLocale}
        localizations={app.localizations}
      />

      <SyncUrlsModal
        open={syncUrlsOpen}
        onOpenChange={setSyncUrlsOpen}
        appId={appId}
        primaryLocale={app.primaryLocale}
        localizations={app.localizations}
        onSynced={handleUrlsSynced}
      />
    </div>
  );
}
