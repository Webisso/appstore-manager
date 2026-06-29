"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconDeviceFloppy,
  IconLoader2,
  IconPlugConnected,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ModelCombobox } from "@/components/ui/model-combobox";
import {
  fetchGeminiModels,
  getGeminiSettings,
  saveGeminiSettings,
  verifyGeminiApi,
} from "@/lib/gemini/settings";
import type { GeminiModelOption } from "@/lib/gemini/types";

export function GeminiSettingsForm() {
  const stored = getGeminiSettings();

  const [apiKey, setApiKey] = useState(stored?.apiKey ?? "");
  const [textModel, setTextModel] = useState(stored?.textModel ?? "");
  const [imageModel, setImageModel] = useState(stored?.imageModel ?? "");
  const [verified, setVerified] = useState(stored?.verified ?? false);
  const [verifying, setVerifying] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [textModels, setTextModels] = useState<GeminiModelOption[]>([]);
  const [imageModels, setImageModels] = useState<GeminiModelOption[]>([]);

  useEffect(() => {
    if (!stored?.verified || !stored.apiKey) return;

    let cancelled = false;
    fetchGeminiModels(stored.apiKey)
      .then((models) => {
        if (cancelled) return;
        setTextModels(models.textModels);
        setImageModels(models.imageModels);
      })
      .catch(() => {
        // Models can be reloaded via verify
      });

    return () => {
      cancelled = true;
    };
  }, [stored?.verified, stored?.apiKey]);

  async function handleVerify() {
    if (!apiKey.trim()) {
      toast.error("Please enter your Gemini API key.");
      return;
    }

    setVerifying(true);
    setVerified(false);

    try {
      await verifyGeminiApi(apiKey.trim());
      setVerified(true);
      toast.success("Gemini API key verified.");

      setLoadingModels(true);
      const models = await fetchGeminiModels(apiKey.trim());
      setTextModels(models.textModels);
      setImageModels(models.imageModels);

      if (!textModel && models.textModels[0]) {
        setTextModel(models.textModels[0].id);
      }
      if (!imageModel && models.imageModels[0]) {
        setImageModel(models.imageModels[0].id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed."
      );
    } finally {
      setVerifying(false);
      setLoadingModels(false);
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error("Please enter your Gemini API key.");
      return;
    }

    if (!verified) {
      toast.error("Please verify your API key before saving.");
      return;
    }

    if (!textModel || !imageModel) {
      toast.error("Please select both text and image models.");
      return;
    }

    setSaving(true);
    try {
      saveGeminiSettings({
        apiKey: apiKey.trim(),
        textModel,
        imageModel,
        verified: true,
      });
      toast.success("Gemini settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <IconSparkles className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">Gemini API</CardTitle>
            <CardDescription>
              Configure Google Gemini for AI-powered features
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="gemini-api-key">API Key</Label>
          <Input
            id="gemini-api-key"
            type="password"
            placeholder="AIza…"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setVerified(false);
            }}
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Get your key from Google AI Studio. Stored locally in your browser.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleVerify}
            disabled={verifying || loadingModels || !apiKey.trim()}
          >
            {verifying || loadingModels ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : verified ? (
              <IconCheck className="size-4 text-green-600" />
            ) : (
              <IconPlugConnected className="size-4" />
            )}
            {loadingModels ? "Loading models…" : "Verify API Key"}
          </Button>
        </div>

        {verified && (
          <>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <ModelCombobox
                label="Text Model"
                value={textModel}
                options={textModels}
                onChange={setTextModel}
                disabled={loadingModels}
              />
              <ModelCombobox
                label="Image Model"
                value={imageModel}
                options={imageModels}
                onChange={setImageModel}
                disabled={loadingModels}
              />
            </div>

            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleSave}
              disabled={saving || !textModel || !imageModel}
            >
              {saving ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="size-4" />
              )}
              Save Settings
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
