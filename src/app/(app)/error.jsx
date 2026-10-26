"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shown instead of a blank crash page; the reference matches the Vercel log entry. */
export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4 rounded-xl bg-white p-8 shadow-paper">
      <AlertCircle className="size-6 text-destructive" />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold text-gray-900">This page hit an error</h1>
        <p className="max-w-prose text-sm text-gray-600">
          Usually a connection (database, Buffer, website or AI) is down or misconfigured. Settings shows each one&apos;s status. If it keeps happening, find
          this reference in Vercel → your project → Logs.
        </p>
        {error?.digest && <p className="font-mono text-xs text-gray-500">Reference: {error.digest}</p>}
      </div>
      <Button onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
