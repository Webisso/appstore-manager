"use client";

import {
  IconCheck,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ImportItemStatus = "pending" | "saving" | "done" | "error" | "skipped";

export interface ImportProgressItem {
  locale: string;
  status: ImportItemStatus;
  detail?: string;
  error?: string;
}

interface ImportProgressPanelProps {
  phase: "importing" | "done";
  items: ImportProgressItem[];
  importingLabel?: string;
  doneLabel?: string;
  savedLabel?: string;
  savingStatusLabel?: string;
}

export function ImportProgressPanel({
  phase,
  items,
  importingLabel = "Processing…",
  doneLabel = "Complete",
  savedLabel = "saved",
  savingStatusLabel = "Saving…",
}: ImportProgressPanelProps) {
  const completedCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const progressValue =
    items.length === 0
      ? 0
      : Math.round(
          (items.filter((i) =>
            ["done", "error", "skipped"].includes(i.status)
          ).length /
            items.length) *
            100
        );

  return (
    <div className="space-y-4 py-1">
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
          {errorCount > 0 && (
            <span className="text-destructive">{errorCount} failed</span>
          )}
          <span>{items.length} total</span>
        </div>
      </div>

      <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 p-2">
        {items.map((item) => (
          <ImportProgressRow
            key={item.locale}
            item={item}
            savingStatusLabel={savingStatusLabel}
          />
        ))}
      </div>
    </div>
  );
}

function ImportProgressRow({
  item,
  savingStatusLabel,
}: {
  item: ImportProgressItem;
  savingStatusLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors",
        item.status === "saving" && "bg-muted/50",
        item.status === "done" && "bg-green-500/5",
        item.status === "error" && "bg-destructive/5"
      )}
    >
      <StatusIcon status={item.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.locale}</span>
          <StatusLabel status={item.status} savingStatusLabel={savingStatusLabel} />
        </div>
        {item.detail && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {item.detail}
          </p>
        )}
        {item.error && (
          <p className="mt-0.5 text-[10px] text-destructive">{item.error}</p>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ImportItemStatus }) {
  switch (status) {
    case "saving":
      return (
        <IconLoader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-foreground" />
      );
    case "done":
      return (
        <IconCheck className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400" />
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
}: {
  status: ImportItemStatus;
  savingStatusLabel: string;
}) {
  const labels: Record<ImportItemStatus, string> = {
    pending: "Waiting",
    saving: savingStatusLabel,
    done: "Saved",
    error: "Failed",
    skipped: "Skipped",
  };

  return (
    <span
      className={cn(
        "text-[10px]",
        status === "done" && "text-green-600 dark:text-green-400",
        status === "error" && "text-destructive",
        status === "saving" && "text-foreground",
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
