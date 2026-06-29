"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

export interface ScreenshotLightboxPreview {
  imageUrl: string;
  alt: string;
  label?: string;
  width?: number;
  height?: number;
}

export function ScreenshotLightbox({
  preview,
  onClose,
}: {
  preview: ScreenshotLightboxPreview;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Screenshot preview"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 right-4 text-white/80 hover:bg-white/10 hover:text-white"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <IconX className="size-5" />
        <span className="sr-only">Close</span>
      </Button>

      {preview.label && (
        <p className="absolute top-4 left-4 text-sm text-white/70">
          {preview.label}
        </p>
      )}

      {preview.width && preview.height && (
        <p className="absolute bottom-4 left-4 text-xs text-white/50">
          {preview.width}×{preview.height}
        </p>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview.imageUrl}
        alt={preview.alt}
        width={preview.width}
        height={preview.height}
        className="max-h-[92vh] max-w-[92vw] object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body
  );
}
