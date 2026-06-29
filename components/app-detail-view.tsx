"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { IconArrowLeft, IconWorld } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LocalizationEditor } from "@/components/localization-editor";
import { ImportToolbar } from "@/components/import/import-toolbar";
import { PrivacyPolicyImportModal } from "@/components/import/privacy-policy-import-modal";
import { AutoTranslateModal } from "@/components/import/auto-translate-modal";
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
  onClick,
}: {
  locale: string;
  isActive: boolean;
  isPrimary: boolean;
  isDirty: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        isActive
          ? "border-foreground bg-foreground text-background shadow-sm"
          : "border-border/70 bg-background text-muted-foreground hover:border-foreground/25 hover:bg-muted/50 hover:text-foreground",
        isDirty && !isActive && "border-amber-500/50 text-amber-700 dark:text-amber-400"
      )}
    >
      {locale}
      {isDirty && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-amber-500",
            isActive && "bg-amber-300"
          )}
        />
      )}
      {isPrimary && !isDirty && (
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
  const [localeQuery, setLocaleQuery] = useState("");
  const [selectedLocale, setSelectedLocale] = useState(
    () =>
      app.localizations.find((loc) => loc.locale === app.primaryLocale)
        ?.locale ??
      app.localizations[0]?.locale ??
      ""
  );
  const [dirtyLocales, setDirtyLocales] = useState<Set<string>>(new Set());
  const [privacyImportOpen, setPrivacyImportOpen] = useState(false);
  const [autoTranslateOpen, setAutoTranslateOpen] = useState(false);

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
    },
    [onLocalizationSaved]
  );

  const filteredLocalizations = useMemo(() => {
    if (!localeQuery.trim()) return app.localizations;
    const q = localeQuery.toLowerCase();
    return app.localizations.filter(
      (loc) =>
        loc.locale.toLowerCase().includes(q) ||
        loc.name?.toLowerCase().includes(q)
    );
  }, [app.localizations, localeQuery]);

  const activeLocalization = useMemo(() => {
    const selected = filteredLocalizations.find(
      (loc) => loc.locale === selectedLocale
    );
    return selected ?? filteredLocalizations[0];
  }, [filteredLocalizations, selectedLocale]);

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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ImportToolbar
              onPrivacyPolicyImport={() => setPrivacyImportOpen(true)}
              onAutoTranslate={() => setAutoTranslateOpen(true)}
            />
            {app.localizations.length > 8 && (
              <Input
                placeholder="Search locale..."
                value={localeQuery}
                onChange={(e) => setLocaleQuery(e.target.value)}
                className="h-8 w-full sm:w-52"
              />
            )}
          </div>
        </div>

        {filteredLocalizations.length === 0 ? (
          <Card className="border-border/60 border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No localizations match your search.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap gap-2">
                {filteredLocalizations.map((loc) => (
                  <LocaleBadge
                    key={loc.locale}
                    locale={loc.locale}
                    isActive={activeLocalization?.locale === loc.locale}
                    isPrimary={loc.locale === app.primaryLocale}
                    isDirty={dirtyLocales.has(loc.locale)}
                    onClick={() => handleLocaleSelect(loc.locale)}
                  />
                ))}
              </div>
            </div>

            {activeLocalization && (
              <LocalizationEditor
                key={`${activeLocalization.locale}-${activeLocalization.appInfoLocalizationId}-${activeLocalization.versionLocalizationId}`}
                appId={appId}
                versionId={app.version?.id}
                canEditWhatsNew={app.version?.canEditWhatsNew ?? false}
                localization={activeLocalization}
                onSaved={handleSaved}
                onDirtyChange={handleDirtyChange}
              />
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
        onTranslated={handleBulkImported}
      />
    </div>
  );
}
