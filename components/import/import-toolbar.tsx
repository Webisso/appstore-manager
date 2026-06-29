"use client";

import { IconDownload, IconLanguage, IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface ImportToolbarProps {
  onPrivacyPolicyImport: () => void;
  onAutoTranslate: () => void;
  onAutoImageGeneration: () => void;
}

export function ImportToolbar({
  onPrivacyPolicyImport,
  onAutoTranslate,
  onAutoImageGeneration,
}: ImportToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAutoImageGeneration}
      >
        <IconSparkles className="size-3.5" />
        Auto Image Generation
      </Button>
    </div>
  );
}
