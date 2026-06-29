"use client";

import { IconDownload, IconLanguage } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface ImportToolbarProps {
  onPrivacyPolicyImport: () => void;
  onAutoTranslate: () => void;
}

export function ImportToolbar({
  onPrivacyPolicyImport,
  onAutoTranslate,
}: ImportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Import</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPrivacyPolicyImport}
      >
        <IconDownload className="size-3.5" />
        Privacy Policy
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAutoTranslate}
      >
        <IconLanguage className="size-3.5" />
        Auto Translate
      </Button>
    </div>
  );
}
