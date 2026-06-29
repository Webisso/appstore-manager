"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconFileUpload,
  IconLoader2,
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  getStoredCredentials,
  saveCredentials,
  testConnection,
} from "@/lib/credentials";
import type { AppleCredentials } from "@/lib/apple/types";

interface SetupFormProps {
  variant?: "onboarding" | "settings";
}

interface FormErrors {
  issuerId?: string;
  keyId?: string;
  privateKey?: string;
}

function validateForm(values: AppleCredentials): FormErrors {
  const errors: FormErrors = {};

  if (!values.issuerId.trim()) {
    errors.issuerId = "Issuer ID is required.";
  } else if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      values.issuerId.trim()
    )
  ) {
    errors.issuerId = "Enter a valid UUID Issuer ID.";
  }

  if (!values.keyId.trim()) {
    errors.keyId = "Key ID is required.";
  } else if (!/^[A-Z0-9]{10}$/.test(values.keyId.trim())) {
    errors.keyId = "Key ID must be 10 alphanumeric characters.";
  }

  if (!values.privateKey.trim()) {
    errors.privateKey = "Private key is required.";
  } else if (
    !values.privateKey.includes("PRIVATE KEY") &&
    values.privateKey.replace(/\s/g, "").length < 100
  ) {
    errors.privateKey = "Paste a valid .p8 private key.";
  }

  return errors;
}

export function SetupForm({ variant = "onboarding" }: SetupFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stored = getStoredCredentials();

  const [issuerId, setIssuerId] = useState(() => stored?.issuerId ?? "");
  const [keyId, setKeyId] = useState(() => stored?.keyId ?? "");
  const [privateKey, setPrivateKey] = useState(() => stored?.privateKey ?? "");
  const [label, setLabel] = useState(() => stored?.label ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionOk, setConnectionOk] = useState(false);
  const isEditing = stored !== null;
  const isSettings = variant === "settings";

  const credentials: AppleCredentials = {
    issuerId: issuerId.trim(),
    keyId: keyId.trim(),
    privateKey: privateKey.trim(),
    label: label.trim() || undefined,
  };

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setPrivateKey(content);
        setConnectionOk(false);
        setErrors((prev) => ({ ...prev, privateKey: undefined }));
      };
      reader.readAsText(file);
    },
    []
  );

  async function handleTestConnection() {
    const validationErrors = validateForm(credentials);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setTesting(true);
    setConnectionOk(false);

    try {
      const result = await testConnection(credentials);
      setConnectionOk(true);
      toast.success(`Connected successfully. Found ${result.appCount} app(s).`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Connection test failed."
      );
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validationErrors = validateForm(credentials);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!connectionOk) {
      toast.error("Please test the connection before saving.");
      return;
    }

    setSaving(true);
    try {
      saveCredentials(credentials);
      toast.success("Credentials saved.");
      router.push("/apps");
    } catch {
      toast.error("Failed to save credentials.");
    } finally {
      setSaving(false);
    }
  }

  const formCard = (
    <Card className="w-full border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-medium">API Credentials</CardTitle>
        <CardDescription>
          Generate a key in App Store Connect → Users and Access → Integrations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="issuerId">Issuer ID</Label>
              <Input
                id="issuerId"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={issuerId}
                onChange={(e) => {
                  setIssuerId(e.target.value);
                  setConnectionOk(false);
                  setErrors((prev) => ({ ...prev, issuerId: undefined }));
                }}
                aria-invalid={!!errors.issuerId}
              />
              {errors.issuerId && (
                <p className="text-xs text-destructive">{errors.issuerId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyId">Key ID</Label>
              <Input
                id="keyId"
                placeholder="ABCD123456"
                value={keyId}
                onChange={(e) => {
                  setKeyId(e.target.value.toUpperCase());
                  setConnectionOk(false);
                  setErrors((prev) => ({ ...prev, keyId: undefined }));
                }}
                aria-invalid={!!errors.keyId}
              />
              {errors.keyId && (
                <p className="text-xs text-destructive">{errors.keyId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Key Name (optional)</Label>
              <Input
                id="label"
                placeholder="Production API Key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="privateKey">Private Key (.p8)</Label>
              <Textarea
                id="privateKey"
                placeholder="-----BEGIN PRIVATE KEY-----&#10;..."
                value={privateKey}
                onChange={(e) => {
                  setPrivateKey(e.target.value);
                  setConnectionOk(false);
                  setErrors((prev) => ({ ...prev, privateKey: undefined }));
                }}
                rows={5}
                className="font-mono text-xs"
                aria-invalid={!!errors.privateKey}
              />
              {errors.privateKey && (
                <p className="text-xs text-destructive">{errors.privateKey}</p>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".p8,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconFileUpload className="size-4" />
                  Upload .p8 file
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleTestConnection}
                disabled={testing || saving}
              >
                {testing ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : connectionOk ? (
                  <IconCheck className="size-4 text-green-600" />
                ) : (
                  <IconPlugConnected className="size-4" />
                )}
                Test Connection
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={saving || testing || !connectionOk}
              >
                {saving && <IconLoader2 className="size-4 animate-spin" />}
                Save {isSettings ? "Settings" : "& Continue"}
              </Button>
              {(isEditing || isSettings) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => router.push("/apps")}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
  );

  if (isSettings) {
    return formCard;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-medium tracking-tight">
          {isEditing ? "Update API Credentials" : "Connect to App Store Connect"}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Enter your API key credentials to browse app metadata. Keys are
          stored locally in your browser.
        </p>
      </div>

      <div className="w-full max-w-lg">{formCard}</div>

      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Credentials are stored in localStorage and sent to this app&apos;s server
        only to sign JWT tokens. Your private key never leaves your machine
        except through secure API routes.
      </p>
    </div>
  );
}
