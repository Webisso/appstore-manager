"use client";

import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ImportItemStatus =
  | "pending"
  | "saving"
  | "correcting"
  | "done"
  | "warning"
  | "error"
  | "skipped";

export interface ImportProgressItem {
  locale: string;
  /** When set, shown instead of locale in the progress list. */
  label?: string;
  status: ImportItemStatus;
  detail?: string;
  error?: string;
  limitCorrectedFields?: string[];
  startedAt?: number;
  elapsedMs?: number;
  /** Optional clickable preview thumbnail (e.g. generated screenshot). */
  previewUrl?: string;
  previewAlt?: string;
  previewWidth?: number;
  previewHeight?: number;
}

export function formatElapsedMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function useLiveElapsedMs(
  startedAt: number | undefined,
  active: boolean,
  frozenMs: number | undefined
): number | undefined {
  const [elapsedMs, setElapsedMs] = useState(frozenMs ?? 0);

  useEffect(() => {
    if (frozenMs !== undefined) {
      setElapsedMs(frozenMs);
      return;
    }

    if (!startedAt || !active) {
      return;
    }

    const tick = () => setElapsedMs(Date.now() - startedAt);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, active, frozenMs]);

  if (frozenMs !== undefined) return frozenMs;
  if (!startedAt) return undefined;
  return elapsedMs;
}

export function ElapsedTimer({
  startedAt,
  active,
  elapsedMs: frozenMs,
  className,
}: {
  startedAt?: number;
  active?: boolean;
  elapsedMs?: number;
  className?: string;
}) {
  const displayMs = useLiveElapsedMs(startedAt, active ?? false, frozenMs);

  if (displayMs === undefined) {
    return (
      <span className={cn("tabular-nums text-muted-foreground/50", className)}>
        —
      </span>
    );
  }

  return (
    <span className={cn("tabular-nums", className)}>{formatElapsedMs(displayMs)}</span>
  );
}

interface ImportProgressPanelProps {
  phase: "importing" | "done";
  items: ImportProgressItem[];
  importingLabel?: string;
  doneLabel?: string;
  savedLabel?: string;
  savingStatusLabel?: string;
  correctingStatusLabel?: string;
  batchStartedAt?: number;
  batchElapsedMs?: number;
  onItemPreviewClick?: (item: ImportProgressItem) => void;
}

export function ImportProgressPanel({
  phase,
  items,
  importingLabel = "Processing…",
  doneLabel = "Complete",
  savedLabel = "saved",
  savingStatusLabel = "Saving…",
  correctingStatusLabel = "Fixing limits…",
  batchStartedAt,
  batchElapsedMs,
  onItemPreviewClick,
}: ImportProgressPanelProps) {
  const completedCount = items.filter((i) => i.status === "done").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const progressValue =
    items.length === 0
      ? 0
      : Math.round(
          (items.filter((i) =>
            ["done", "warning", "error", "skipped"].includes(i.status)
          ).length /
            items.length) *
            100
        );

  const showBatchTimer = batchStartedAt !== undefined;

  return (
    <div className="space-y-4 py-1">
      {showBatchTimer && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconClock className="size-3.5" />
            <span>Total elapsed</span>
          </div>
          <ElapsedTimer
            startedAt={batchStartedAt}
            active={phase === "importing"}
            elapsedMs={batchElapsedMs}
            className="text-sm font-medium text-foreground"
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {phase === "importing" ? importingLabel : doneLabel}
          </span>
          <span className="font-medium tabular-nums">{progressValue}%</span>
        </div>
        <Progress value={progressValue} className="h-2" />
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="text-green-600 dark:text-green-400">
            {completedCount} {savedLabel}
          </span>
          {warningCount > 0 && (
            <span className="text-orange-600 dark:text-orange-400">
              {warningCount} need fix
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-destructive">{errorCount} failed</span>
          )}
          <span>{items.length} total</span>
        </div>
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 p-2">
        {items.map((item) => (
          <ImportProgressRow
            key={item.label ?? item.locale}
            item={item}
            savingStatusLabel={savingStatusLabel}
            correctingStatusLabel={correctingStatusLabel}
            onPreviewClick={onItemPreviewClick}
          />
        ))}
      </div>
    </div>
  );
}

function ImportProgressRow({
  item,
  savingStatusLabel,
  correctingStatusLabel,
  onPreviewClick,
}: {
  item: ImportProgressItem;
  savingStatusLabel: string;
  correctingStatusLabel: string;
  onPreviewClick?: (item: ImportProgressItem) => void;
}) {
  const isActive = item.status === "saving" || item.status === "correcting";
  const hasTimer =
    item.startedAt !== undefined || item.elapsedMs !== undefined;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors",
        item.status === "saving" && "bg-muted/50",
        item.status === "correcting" && "bg-amber-500/5",
        item.status === "done" && "bg-green-500/5",
        item.status === "warning" && "bg-orange-500/5",
        item.status === "error" && "bg-destructive/5"
      )}
    >
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.label ?? item.locale}</span>
          <StatusLabel
            status={item.status}
            savingStatusLabel={savingStatusLabel}
            correctingStatusLabel={correctingStatusLabel}
          />
        </div>
        {item.detail && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {item.detail}
          </p>
        )}
        {item.limitCorrectedFields && item.limitCorrectedFields.length > 0 && (
          <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            Limit corrected: {item.limitCorrectedFields.join(", ")}
          </p>
        )}
        {item.error && (
          <p
            className={cn(
              "mt-0.5 text-[10px]",
              item.status === "warning"
                ? "text-orange-600 dark:text-orange-400"
                : "text-destructive"
            )}
          >
            {item.error}
          </p>
        )}
      </div>
      {hasTimer && (
        <div className="flex shrink-0 items-center gap-1 pt-0.5 text-[10px] text-muted-foreground">
          <IconClock className="size-3" />
          <ElapsedTimer
            startedAt={item.startedAt}
            active={isActive}
            elapsedMs={item.elapsedMs}
          />
        </div>
      )}
      {item.previewUrl && item.status === "done" && (
        <button
          type="button"
          onClick={() => onPreviewClick?.(item)}
          className="shrink-0 overflow-hidden rounded border border-border/60 bg-muted/30 transition hover:border-foreground/25 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={item.previewAlt ?? "View screenshot preview"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt={item.previewAlt ?? "Screenshot preview"}
            className="object-contain"
            style={
              item.previewWidth && item.previewHeight
                ? {
                    aspectRatio: `${item.previewWidth} / ${item.previewHeight}`,
                    height: "72px",
                    width: "auto",
                  }
                : { height: "72px", width: "auto" }
            }
          />
        </button>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ImportItemStatus }) {
  switch (status) {
    case "saving":
    case "correcting":
      return (
        <IconLoader2
          className={cn(
            "mt-0.5 size-3.5 shrink-0 animate-spin",
            status === "correcting"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
          )}
        />
      );
    case "done":
      return (
        <IconCheck className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400" />
      );
    case "warning":
      return (
        <IconAlertTriangle
          className="mt-0.5 size-3.5 shrink-0 text-orange-600 dark:text-orange-400"
        />
      );
    case "error":
      return (
        <IconX className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      );
    case "skipped":
      return (
        <span className="mt-1 size-3.5 shrink-0 rounded-full bg-muted-foreground/30" />
      );
    default:
      return (
        <span className="mt-1 size-3.5 shrink-0 rounded-full border border-border" />
      );
  }
}

function StatusLabel({
  status,
  savingStatusLabel,
  correctingStatusLabel,
}: {
  status: ImportItemStatus;
  savingStatusLabel: string;
  correctingStatusLabel: string;
}) {
  const labels: Record<ImportItemStatus, string> = {
    pending: "Waiting",
    saving: savingStatusLabel,
    correcting: correctingStatusLabel,
    done: "Saved",
    warning: "Needs fix",
    error: "Failed",
    skipped: "Skipped",
  };

  return (
    <span
      className={cn(
        "text-[10px]",
        status === "done" && "text-green-600 dark:text-green-400",
        status === "warning" && "text-orange-600 dark:text-orange-400",
        status === "error" && "text-destructive",
        status === "saving" && "text-foreground",
        status === "correcting" &&
          "text-amber-600 dark:text-amber-400",
        (status === "pending" || status === "skipped") && "text-muted-foreground"
      )}
    >
      {labels[status]}
    </span>
  );
}

export function getSavingStatusLabel(mode: "import" | "translate"): string {
  return mode === "translate" ? "Translating…" : "Saving…";
}
