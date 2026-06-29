"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconBrandApple, IconSparkles } from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SetupForm } from "@/components/setup-form";
import { GeminiSettingsForm } from "@/components/settings/gemini-settings-form";
import { getGeminiSettings } from "@/lib/gemini/settings";

export function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "gemini" ? "gemini" : "apple";
  const geminiConfigured = Boolean(getGeminiSettings()?.verified);

  function handleTabChange(value: string) {
    router.replace(`/settings?tab=${value}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/apps"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <IconArrowLeft className="size-3.5" />
          Back to apps
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Apple and Gemini integrations
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="mb-6 h-auto w-full justify-start gap-1 bg-muted/40 p-1">
            <TabsTrigger
              value="apple"
              className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-none sm:px-6"
            >
              <IconBrandApple className="size-4" />
              Apple Settings
            </TabsTrigger>
            <TabsTrigger
              value="gemini"
              className="flex-1 gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm sm:flex-none sm:px-6"
            >
              <IconSparkles className="size-4" />
              Gemini Settings
              {geminiConfigured && (
                <span className="size-1.5 rounded-full bg-green-500" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="apple" className="mt-0">
            <SetupForm variant="settings" />
          </TabsContent>

          <TabsContent value="gemini" className="mt-0">
            <GeminiSettingsForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
