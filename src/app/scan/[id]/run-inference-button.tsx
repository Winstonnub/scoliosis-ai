"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ScanStatus = "UPLOADED" | "RUNNING" | "DONE" | "FAILED";

export function RunInferenceButton({
  scanId,
  status,
}: {
  scanId: string;
  status: ScanStatus;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // If the database says RUNNING, we disable the button.
  // This prevents double-click creating multiple inference runs.
  const disabled = loading || status === "RUNNING";

  // Button label changes based on status
  const label =
    status === "RUNNING"
      ? "Running..."
      : status === "DONE"
      ? "Re-run inference"
      : status === "FAILED"
      ? "Retry inference"
      : "Run inference";

  // Auto-refresh while RUNNING so the UI updates to DONE/FAILED without manual refresh.
  useEffect(() => {
    if (status !== "RUNNING") return;

    const t = setInterval(() => {
      router.refresh();
    }, 2000);

    return () => clearInterval(t);
  }, [status, router]);

  async function run() {
    setLoading(true);

    try {
      const res = await fetch("/api/scans/run-inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId }),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(`Inference failed (${res.status}): ${text}`);
        router.refresh(); // refresh to show FAILED status if set
        return;
      }

      const data = await res.json();
      alert(`Inference done ✅ saved ${data.count} detections`);
      router.refresh(); // refresh to show detections + DONE
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={disabled}>
      {loading ? "Running..." : label}
    </Button>
  );
}