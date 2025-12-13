"use client";

import { useEffect, useState } from "react";
import { BBoxOverlay } from "./bbox-overlay";

type Detection = {
  id: string;
  className: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function S3Image({
  scanId,
  detections,
}: {
  scanId: string;
  detections: Detection[];
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr(null);
      const res = await fetch(`/api/uploads/view?scanId=${scanId}`);
      if (!res.ok) {
        const text = await res.text();
        if (!cancelled) setErr(text);
        return;
      }
      const data = await res.json();
      if (!cancelled) setSignedUrl(data.signedUrl);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scanId]);

  if (err) return <p className="text-sm text-red-600">Image load failed: {err}</p>;
  if (!signedUrl) return <p className="text-sm text-muted-foreground">Loading image...</p>;

  return <BBoxOverlay imageUrl={signedUrl} detections={detections} />;
}