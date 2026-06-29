"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconDeviceFloppy, IconLoader2, IconRotate } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  getStoredCredentials,
  saveLocalizationFromApi,
} from "@/lib/credentials";
import type { LocalizationDetail } from "@/lib/apple/types";

export interface LocalizationFormValues {
  name: string;
  subtitle: string;
  privacyPolicyUrl: string;
  supportUrl: string;
  marketingUrl: string;
  description: string;
  keywords: string;
  whatsNew: string;
}

function toFormValues(loc: LocalizationDetail): LocalizationFormValues {
  return {
    name: loc.name ?? "",
    subtitle: loc.subtitle ?? "",
    privacyPolicyUrl: loc.privacyPolicyUrl ?? "",
    supportUrl: loc.supportUrl ?? "",
    marketingUrl: loc.marketingUrl ?? "",
    description: (loc.description ?? "").replace(/\\n/g, "\n"),
    keywords: loc.keywords ?? "",
    whatsNew: (loc.whatsNew ?? "").replace(/\\n/g, "\n"),
  };
}

interface EditableFieldProps {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  mono?: boolean;
  maxLength?: number;
  rows?: number;
}

function EditableField({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  mono = false,
  maxLength,
  rows = 6,
}: EditableFieldProps) {
  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {maxLength !== undefined && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <InputComponent
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={multiline ? rows : undefined}
        className={cn(
          "bg-background text-sm",
          mono && "font-mono text-xs",
          multiline && "min-h-[120px] resize-y leading-relaxed"
        )}
      />
    </div>
  );
}

interface LocalizationEditorProps {
  appId: string;
  versionId?: string;
  canEditWhatsNew?: boolean;
  localization: LocalizationDetail;
  onSaved: (updated: LocalizationDetail) => void;
  onDirtyChange?: (locale: string, dirty: boolean) => void;
}

function formForCompare(
  values: LocalizationFormValues,
  includeWhatsNew: boolean
): LocalizationFormValues {
  if (includeWhatsNew) return values;
  return { ...values, whatsNew: "" };
}

export function LocalizationEditor({
  appId,
  versionId,
  canEditWhatsNew = false,
  localization,
  onSaved,
  onDirtyChange,
}: LocalizationEditorProps) {
  const [form, setForm] = useState<LocalizationFormValues>(() =>
    toFormValues(localization)
  );
  const [snapshot, setSnapshot] = useState<LocalizationFormValues>(() =>
    toFormValues(localization)
  );
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      JSON.stringify(formForCompare(form, canEditWhatsNew)) !==
      JSON.stringify(formForCompare(snapshot, canEditWhatsNew)),
    [form, snapshot, canEditWhatsNew]
  );

  useEffect(() => {
    onDirtyChange?.(localization.locale, isDirty);
  }, [isDirty, localization.locale, onDirtyChange]);

  const updateField = useCallback(
    (field: keyof LocalizationFormValues, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  function handleReset() {
    setForm(snapshot);
  }

  async function handleSave() {
    const credentials = getStoredCredentials();
    if (!credentials) {
      toast.error("Credentials not found. Please reconnect.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveLocalizationFromApi(
        credentials,
        appId,
        versionId,
        {
          locale: localization.locale,
          appInfoLocalizationId: localization.appInfoLocalizationId,
          versionLocalizationId: localization.versionLocalizationId,
          name: form.name,
          subtitle: form.subtitle,
          privacyPolicyUrl: form.privacyPolicyUrl,
          description: form.description,
          keywords: form.keywords,
          supportUrl: form.supportUrl,
          marketingUrl: form.marketingUrl,
          ...(canEditWhatsNew
            ? { whatsNew: form.whatsNew, includeWhatsNew: true }
            : { includeWhatsNew: false }),
        }
      );

      setSnapshot(form);
      onSaved(result.localization);
      toast.success(`${localization.locale} saved successfully.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  const canSaveVersionFields = Boolean(
    localization.versionLocalizationId || versionId
  );

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium">
              {localization.locale}
            </CardTitle>
            <CardDescription>
              Edit App Store metadata for this locale
            </CardDescription>
          </div>
          {isDirty && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <EditableField
          label="Name"
          value={form.name}
          onChange={(v) => updateField("name", v)}
          maxLength={30}
        />
        <EditableField
          label="Subtitle"
          value={form.subtitle}
          onChange={(v) => updateField("subtitle", v)}
          maxLength={30}
        />
        <EditableField
          label="Privacy Policy URL"
          value={form.privacyPolicyUrl}
          onChange={(v) => updateField("privacyPolicyUrl", v)}
        />

        <Separator />

        {!canSaveVersionFields && (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Version-level fields require an editable App Store version. Create a
            new version in App Store Connect to edit description, keywords, and
            URLs.
          </p>
        )}

        <EditableField
          label="Support URL"
          value={form.supportUrl}
          onChange={(v) => updateField("supportUrl", v)}
        />
        <EditableField
          label="Marketing URL"
          value={form.marketingUrl}
          onChange={(v) => updateField("marketingUrl", v)}
        />
        <EditableField
          label="Description"
          hint="Use blank lines for paragraphs, like in App Store Connect."
          value={form.description}
          onChange={(v) => updateField("description", v)}
          multiline
          rows={10}
          maxLength={4000}
        />
        <EditableField
          label="Keywords"
          hint="Comma-separated. Max 100 characters."
          value={form.keywords}
          onChange={(v) => updateField("keywords", v)}
          mono
          maxLength={100}
        />
        {canEditWhatsNew ? (
          <EditableField
            label="What's New"
            hint="Release notes for this version update."
            value={form.whatsNew}
            onChange={(v) => updateField("whatsNew", v)}
            multiline
            rows={6}
            maxLength={4000}
          />
        ) : (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            What&apos;s New is only available for app updates, not the initial
            App Store release.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={!isDirty || saving}
        >
          <IconRotate className="size-4" />
          Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="size-4" />
          )}
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
