"use client";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <ErrorState
        message="This page could not be loaded. The server may be unavailable."
        onRetry={reset}
      />
    </Card>
  );
}
