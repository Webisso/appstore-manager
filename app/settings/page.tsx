import { Suspense } from "react";
import { SettingsPageContent } from "@/components/settings/settings-page-content";
import { Skeleton } from "@/components/ui/skeleton";

function SettingsFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
