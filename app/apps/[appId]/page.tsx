"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { AppDetailView } from "@/components/app-detail-view";
import { CredentialsGate } from "@/components/credentials-gate";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAppDetailFromApi,
  getStoredCredentials,
} from "@/lib/credentials";
import type { AppDetail } from "@/lib/apple/types";

function AppDetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function AppDetailPageContent() {
  const params = useParams<{ appId: string }>();
  const appId = params.appId;

  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const credentials = getStoredCredentials();
    if (!credentials || !appId) return;

    fetchAppDetailFromApi(credentials, appId)
      .then((result) => {
        if (!cancelled) setApp(result.app);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load app details.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appId]);

  function retryLoad() {
    const credentials = getStoredCredentials();
    if (!credentials || !appId) return;

    setLoading(true);
    setError(null);

    fetchAppDetailFromApi(credentials, appId)
      .then((result) => setApp(result.app))
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Failed to load app details.";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={app?.name ?? "App details"} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {loading && <AppDetailSkeleton />}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={retryLoad}
              className="mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && app && (
          <AppDetailView
            app={app}
            appId={appId}
            onLocalizationSaved={(updated) => {
              setApp((prev) =>
                prev
                  ? {
                      ...prev,
                      localizations: prev.localizations.map((loc) =>
                        loc.locale === updated.locale ? updated : loc
                      ),
                    }
                  : prev
              );
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function AppDetailPage() {
  return (
    <CredentialsGate>
      <AppDetailPageContent />
    </CredentialsGate>
  );
}
