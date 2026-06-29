"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AppIconPlaceholder } from "@/components/app-icon-placeholder";

interface AppIconProps {
  name: string;
  iconUrl?: string;
  className?: string;
}

export function AppIcon({ name, iconUrl, className }: AppIconProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showPlaceholder = !iconUrl || imageFailed;

  if (showPlaceholder) {
    return (
      <div
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted shadow-sm ring-1 ring-border/40 transition-transform group-hover:scale-105",
          className
        )}
      >
        <AppIconPlaceholder
          className="size-7"
          label={`${name} icon placeholder`}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl}
      alt={`${name} icon`}
      width={48}
      height={48}
      onError={() => setImageFailed(true)}
      className={cn(
        "size-12 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-border/40 transition-transform group-hover:scale-105",
        className
      )}
    />
  );
}
