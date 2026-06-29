"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasCredentials } from "@/lib/credentials";
import { Skeleton } from "@/components/ui/skeleton";

interface CredentialsGateProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireCredentials?: boolean;
}

export function CredentialsGate({
  children,
  redirectTo = "/settings?tab=apple",
  requireCredentials = true,
}: CredentialsGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const exists = hasCredentials();

    if (requireCredentials && !exists) {
      router.replace(redirectTo);
      return;
    }

    const frame = requestAnimationFrame(() => setAllowed(true));
    return () => cancelAnimationFrame(frame);
  }, [requireCredentials, redirectTo, router]);

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
