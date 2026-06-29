"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { hasCredentials } from "@/lib/credentials";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(hasCredentials() ? "/apps" : "/settings?tab=apple");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
