"use client";

import { useEffect, useState } from "react";
import {
  IconCheck,
  IconDeviceFloppy,
  IconLoader2,
  IconPhotoAi,
  IconPlugConnected,
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
  fetchWiroModels,
  getWiroSettings,
  saveWiroSettings,
  verifyWiroApi,
} from "@/lib/wiro/settings";
import type { WiroModelOption } from "@/lib/wiro/types";

export function WiroSettingsForm() {
  const stored = getWiroSettings();

  const [apiKey, setApiKey] = useState(stored?.apiKey ?? "");
  const [apiSecret, setApiSecret] = useState(stored?.apiSecret ?? "");
  const [imageModel, setImageModel] = useState(stored?.imageModel ?? "");
  const [verified, setVerified] = useState(stored?.verified ?? false);
  const [verifying, setVerifying] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageModels, setImageModels] = useState<WiroModelOption[]>([]);

  useEffect(() => {
    if (!stored?.verified || !stored.apiKey) return;

    let cancelled = false;
    fetchWiroModels(stored.apiKey, stored.apiSecret)
      .then((models) => {
        if (cancelled) return;
        setImageModels(models.imageModels);
      })
      .catch(() => {
        // Models can be reloaded via verify
      });

    return () => {
      cancelled = true;
    };
  }, [stored?.verified, stored?.apiKey, stored?.apiSecret]);

  async function handleVerify() {
    if (!apiKey.trim()) {
      toast.error("Please enter your Wiro API key.");
      return;
    }

    if (!apiSecret.trim()) {
      toast.error("Please enter your Wiro API secret.");
      return;
    }

    setVerifying(true);
    setVerified(false);

    try {
      await verifyWiroApi(apiKey.trim(), apiSecret.trim());
      setVerified(true);
      toast.success("Wiro credentials verified.");

      setLoadingModels(true);
      const models = await fetchWiroModels(apiKey.trim(), apiSecret.trim());
      setImageModels(models.imageModels);

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
      toast.error("Please enter your Wiro API key.");
      return;
    }

    if (!apiSecret.trim()) {
      toast.error("Please enter your Wiro API secret.");
      return;
    }

    if (!verified) {
      toast.error("Please verify your credentials before saving.");
      return;
    }

    if (!imageModel) {
      toast.error("Please select an image model.");
      return;
    }

    setSaving(true);
    try {
      saveWiroSettings({
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        imageModel,
        verified: true,
      });
      toast.success("Wiro settings saved.");
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
            <IconPhotoAi className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base font-medium">Wiro AI</CardTitle>
            <CardDescription>
              Configure Wiro for AI-powered image generation and editing
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="wiro-api-key">API Key</Label>
          <Input
            id="wiro-api-key"
            type="password"
            placeholder="Your Wiro API key"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setVerified(false);
            }}
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wiro-api-secret">API Secret</Label>
          <Input
            id="wiro-api-secret"
            type="password"
            placeholder="Your Wiro API secret"
            value={apiSecret}
            onChange={(e) => {
              setApiSecret(e.target.value);
              setVerified(false);
            }}
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Get your credentials from the Wiro dashboard. Stored locally in your
            browser.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleVerify}
            disabled={
              verifying ||
              loadingModels ||
              !apiKey.trim() ||
              !apiSecret.trim()
            }
          >
            {verifying || loadingModels ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : verified ? (
              <IconCheck className="size-4 text-green-600" />
            ) : (
              <IconPlugConnected className="size-4" />
            )}
            {loadingModels ? "Loading models…" : "Verify Credentials"}
          </Button>
        </div>

        {verified && (
          <>
            <Separator />
            <ModelCombobox
              label="Image Model"
              value={imageModel}
              options={imageModels}
              onChange={setImageModel}
              disabled={loadingModels}
            />

            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleSave}
              disabled={saving || !imageModel}
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
