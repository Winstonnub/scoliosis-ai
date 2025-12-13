"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);

    // 1) Ask Next.js for a presigned upload URL
    const presignRes = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

    if (!presignRes.ok) {
      const text = await presignRes.text();
      alert(`Presign failed (${presignRes.status}): ${text}`);
      setLoading(false);
      return;
    }

    const { uploadUrl, key } = await presignRes.json();

    // 2) Upload directly to S3
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      alert(`S3 upload failed (${putRes.status}): ${text}`);
      setLoading(false);
      return;
    }

    // 3) Create scan row pointing at the S3 key
    const createRes = await fetch("/api/scans/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ s3Key: key }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      alert(`Create scan failed (${createRes.status}): ${text}`);
      setLoading(false);
      return;
    }

    const { scanId } = await createRes.json();
    setLoading(false);

    router.push(`/scan/${scanId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button type="submit" disabled={!file || loading}>
        {loading ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}