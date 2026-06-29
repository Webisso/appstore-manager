"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconDeviceIpad,
  IconDeviceMobile,
  IconLoader2,
  IconPhoto,
  IconRefresh,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  fetchLocalizationScreenshotsFromApi,
  getStoredCredentials,
} from "@/lib/credentials";
import { CreateScreenshotsAiModal } from "@/components/import/create-screenshots-ai-modal";
import {
  ScreenshotLightbox,
  type ScreenshotLightboxPreview,
} from "@/components/screenshot-lightbox";
import type {
  AppScreenshotDetail,
  AppScreenshotSetDetail,
  LocalizationScreenshots,
  ScreenshotDeviceCategory,
} from "@/lib/apple/types";

interface LocalizationScreenshotsProps {
  appId: string;
  locale: string;
  versionLocalizationId?: string;
  primaryLocale?: string;
  sourceVersionLocalizationId?: string;
}

function ScreenshotThumbnail({
  shot,
  index,
  setLabel,
  onClick,
}: {
  shot: AppScreenshotDetail;
  index: number;
  setLabel: string;
  onClick: () => void;
}) {
  const alt = shot.fileName ?? `Screenshot ${index + 1}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20 transition hover:border-foreground/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${alt}`}
    >
      {shot.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shot.imageUrl}
          alt={alt}
          width={shot.width ?? 180}
          height={shot.height ?? 390}
          className="h-64 w-auto object-contain transition group-hover:brightness-95"
          loading="lazy"
        />
      ) : (
        <div className="flex h-64 w-32 items-center justify-center text-xs text-muted-foreground">
          No preview
        </div>
      )}
      <span className="sr-only">{setLabel}</span>
    </button>
  );
}

function DeviceSection({
  title,
  icon: Icon,
  sets,
  onScreenshotClick,
  deviceCategory,
  canCreateWithAi,
  onCreateWithAi,
}: {
  title: string;
  icon: typeof IconDeviceMobile;
  sets: AppScreenshotSetDetail[];
  onScreenshotClick: (preview: ScreenshotLightboxPreview) => void;
  deviceCategory: ScreenshotDeviceCategory;
  canCreateWithAi: boolean;
  onCreateWithAi: (category: ScreenshotDeviceCategory) => void;
}) {
  if (sets.length === 0) {
    return (
      <Card className="border-border/60 border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center text-sm text-muted-foreground">
          <p>No {title.toLowerCase()} screenshots for this locale.</p>
          {canCreateWithAi && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCreateWithAi(deviceCategory)}
            >
              <IconSparkles className="size-4" />
              Create with AI
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {sets.reduce((count, set) => count + set.screenshots.length, 0)} images
        </span>
      </div>

      <div className="space-y-5">
        {sets.map((set) => (
          <Card key={set.id} className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                {set.displayLabel}
              </CardTitle>
              <CardDescription className="text-xs">
                {set.screenshots.length} screenshot{set.screenshots.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="overflow-x-auto pb-2">
                <div className="flex flex-nowrap gap-3">
                  {set.screenshots.map((shot, index) => (
                    <ScreenshotThumbnail
                      key={shot.id}
                      shot={shot}
                      index={index}
                      setLabel={set.displayLabel}
                      onClick={() => {
                        if (!shot.imageUrl) return;
                        onScreenshotClick({
                          imageUrl: shot.imageUrl,
                          alt: shot.fileName ?? `Screenshot ${index + 1}`,
                          label: `${set.displayLabel} · ${index + 1} of ${set.screenshots.length}`,
                          width: shot.width,
                          height: shot.height,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function LocalizationScreenshots({
  appId,
  locale,
  versionLocalizationId,
  primaryLocale,
  sourceVersionLocalizationId,
}: LocalizationScreenshotsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LocalizationScreenshots | null>(null);
  const [preview, setPreview] = useState<ScreenshotLightboxPreview | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiDeviceCategory, setAiDeviceCategory] =
    useState<ScreenshotDeviceCategory>("iphone");

  const canCreateWithAi = Boolean(
    primaryLocale &&
      sourceVersionLocalizationId &&
      versionLocalizationId &&
      locale !== primaryLocale
  );

  const loadScreenshots = useCallback(async () => {
    if (!versionLocalizationId) {
      setData(null);
      setError(null);
      return;
    }

    const credentials = getStoredCredentials();
    if (!credentials) {
      setError("Apple credentials not found.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchLocalizationScreenshotsFromApi(
        credentials,
        appId,
        versionLocalizationId
      );
      setData(result.screenshots);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load screenshots.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [appId, versionLocalizationId]);

  useEffect(() => {
    setPreview(null);
  }, [locale, versionLocalizationId]);

  useEffect(() => {
    void loadScreenshots();
  }, [loadScreenshots]);

  const groupedSets = useMemo(() => {
    const sets = data?.sets ?? [];
    const byCategory = (category: ScreenshotDeviceCategory) =>
      sets.filter(
        (set) => set.deviceCategory === category && set.screenshots.length > 0
      );

    return {
      iphone: byCategory("iphone"),
      ipad: byCategory("ipad"),
      other: byCategory("other"),
    };
  }, [data]);

  function handleCreateWithAi(category: ScreenshotDeviceCategory) {
    setAiDeviceCategory(category);
    setAiModalOpen(true);
  }

  if (!versionLocalizationId) {
    return (
      <Card className="border-border/60 border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No version localization found for this locale. Screenshots are only
          available on App Store version localizations.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconPhoto className="size-4" />
          <span>{locale} screenshots</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadScreenshots()}
          disabled={loading}
        >
          {loading ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {loading && !data && (
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Fetching screenshots from App Store Connect…
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-destructive/30">
          <CardContent className="py-8 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && data && (
        <div className="space-y-8">
          <DeviceSection
            title="iPhone"
            icon={IconDeviceMobile}
            sets={groupedSets.iphone}
            onScreenshotClick={setPreview}
            deviceCategory="iphone"
            canCreateWithAi={canCreateWithAi}
            onCreateWithAi={handleCreateWithAi}
          />
          <DeviceSection
            title="iPad"
            icon={IconDeviceIpad}
            sets={groupedSets.ipad}
            onScreenshotClick={setPreview}
            deviceCategory="ipad"
            canCreateWithAi={canCreateWithAi}
            onCreateWithAi={handleCreateWithAi}
          />
          {groupedSets.other.length > 0 && (
            <DeviceSection
              title="Other"
              icon={IconPhoto}
              sets={groupedSets.other}
              onScreenshotClick={setPreview}
              deviceCategory="other"
              canCreateWithAi={false}
              onCreateWithAi={handleCreateWithAi}
            />
          )}
        </div>
      )}

      {preview && (
        <ScreenshotLightbox preview={preview} onClose={() => setPreview(null)} />
      )}

      {canCreateWithAi && primaryLocale && sourceVersionLocalizationId && (
        <CreateScreenshotsAiModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          appId={appId}
          targetLocale={locale}
          targetVersionLocalizationId={versionLocalizationId}
          sourceLocale={primaryLocale}
          sourceVersionLocalizationId={sourceVersionLocalizationId}
          deviceCategory={aiDeviceCategory}
          onUploaded={() => void loadScreenshots()}
        />
      )}
    </div>
  );
}
