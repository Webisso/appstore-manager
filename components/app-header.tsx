"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBrandApple, IconSettings } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  clearCredentials,
  getStoredCredentials,
} from "@/lib/credentials";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  showSettings?: boolean;
}

export function AppHeader({
  title = "App Store Connect",
  subtitle,
  showSettings = true,
}: AppHeaderProps) {
  const router = useRouter();
  const credentials = getStoredCredentials();

  function handleLogout() {
    clearCredentials();
    router.push("/settings?tab=apple");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background">
            <IconBrandApple className="size-5" stroke={1.5} />
          </div>
          <div>
            <Link
              href="/apps"
              className="text-sm font-medium tracking-tight transition-opacity hover:opacity-70"
            >
              {title}
            </Link>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSettings && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <IconSettings className="size-4" />
                Settings
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Disconnect
          </Button>
        </div>
      </div>
    </header>
  );
}
