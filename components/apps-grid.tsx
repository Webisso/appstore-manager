"use client";

import Link from "next/link";
import { IconApps } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppSummary } from "@/lib/apple/types";

function AppIcon({ name, iconUrl }: { name: string; iconUrl?: string }) {
  const initial = name.charAt(0).toUpperCase();

  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={`${name} icon`}
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-border/40 transition-transform group-hover:scale-105"
      />
    );
  }

  return (
    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-medium text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
      {initial}
    </div>
  );
}

function AppCardSkeleton() {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardHeader>
    </Card>
  );
}

export function AppsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <AppCardSkeleton key={i} />
      ))}
    </div>
  );
}

interface AppsGridProps {
  apps: AppSummary[];
}

export function AppsGrid({ apps }: AppsGridProps) {
  if (apps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
          <IconApps className="size-8 text-muted-foreground" stroke={1.5} />
        </div>
        <h3 className="text-sm font-medium">No apps found</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your App Store Connect account doesn&apos;t have any apps, or your API
          key lacks the required permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {apps.map((app) => (
        <Link key={app.id} href={`/apps/${app.id}`} className="group">
          <Card className="h-full border-border/60 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <AppIcon name={app.name} iconUrl={app.iconUrl} />
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-sm font-medium">
                  {app.name}
                </CardTitle>
                <CardDescription className="mt-1 truncate font-mono text-xs">
                  {app.bundleId}
                </CardDescription>
              </div>
            </CardHeader>
            {app.primaryLocale && (
              <CardContent className="pt-0">
                <Badge variant="secondary" className="text-xs font-normal">
                  {app.primaryLocale}
                </Badge>
              </CardContent>
            )}
          </Card>
        </Link>
      ))}
    </div>
  );
}
