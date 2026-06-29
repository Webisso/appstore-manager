"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { AppsGrid, AppsGridSkeleton } from "@/components/apps-grid";
import { CredentialsGate } from "@/components/credentials-gate";
import {
  fetchAppsFromApi,
  getStoredCredentials,
} from "@/lib/credentials";
import type { AppSummary } from "@/lib/apple/types";

function AppsPageContent() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const credentials = getStoredCredentials();
    if (!credentials) return;

    fetchAppsFromApi(credentials)
      .then((result) => {
        if (!cancelled) setApps(result.apps);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load apps.";
        setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Your apps" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">Apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select an app to view its App Store metadata
          </p>
        </div>

        {loading && <AppsGridSkeleton />}

        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => {
                const credentials = getStoredCredentials();
                if (!credentials) return;
                setLoading(true);
                setError(null);
                fetchAppsFromApi(credentials)
                  .then((result) => setApps(result.apps))
                  .catch((err) => {
                    const message =
                      err instanceof Error ? err.message : "Failed to load apps.";
                    setError(message);
                    toast.error(message);
                  })
                  .finally(() => setLoading(false));
              }}
              className="mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && <AppsGrid apps={apps} />}
      </main>
    </div>
  );
}

export default function AppsPage() {
  return (
    <CredentialsGate>
      <AppsPageContent />
    </CredentialsGate>
  );
}
