export const dynamic = "force-dynamic";
export const revalidate = 0;

import { RunInferenceButton } from "./run-inference-button";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { S3Image } from "./s3-image";

type LiteDet = { className: string; confidence: number };

function summarizeScan(detections: LiteDet[]) {
  // Tune these later
  const MIN_CONF = 0.25; // ignore weak predictions
  const STRONG_CONF = 0.5; // “strong evidence” threshold
  const MARGIN = 0.1; // how much higher one score must be to “win”

  const scoliosis = detections
    .filter((d) => d.className === "scoliosis spine" && d.confidence >= MIN_CONF)
    .sort((a, b) => b.confidence - a.confidence);

  const normal = detections
    .filter((d) => d.className === "normal spine" && d.confidence >= MIN_CONF)
    .sort((a, b) => b.confidence - a.confidence);

  const bestS = scoliosis[0]?.confidence ?? 0;
  const bestN = normal[0]?.confidence ?? 0;

  // Score = max confidence + small bonus for multiple supporting detections
  // (caps at +0.15 so it doesn’t go crazy)
  const scoreS = bestS + Math.min(0.15, 0.05 * Math.max(0, scoliosis.length - 1));
  const scoreN = bestN + Math.min(0.15, 0.05 * Math.max(0, normal.length - 1));

  const evidenceS =
    scoliosis.length === 0
      ? "no scoliosis detections above threshold"
      : `best scoliosis ${Math.round(bestS * 100)}% (${scoliosis.length} det.)`;

  const evidenceN =
    normal.length === 0
      ? "no normal detections above threshold"
      : `best normal ${Math.round(bestN * 100)}% (${normal.length} det.)`;

  // 1) Strong single-class evidence
  if (bestS >= STRONG_CONF && bestN < STRONG_CONF) {
    return {
      label: "Scoliosis",
      confidence: bestS,
      reason: `Strong scoliosis evidence: ${evidenceS}`,
      debug: { scoreS, scoreN, evidenceS, evidenceN },
    };
  }

  if (bestN >= STRONG_CONF && bestS < STRONG_CONF) {
    return {
      label: "Normal",
      confidence: bestN,
      reason: `Strong normal evidence: ${evidenceN}`,
      debug: { scoreS, scoreN, evidenceS, evidenceN },
    };
  }

  // 2) Compare scores if both have some evidence
  if (scoreS > 0 || scoreN > 0) {
    if (scoreS - scoreN >= MARGIN) {
      return {
        label: "Scoliosis",
        confidence: bestS,
        reason: `Scoliosis score higher (Δ=${(scoreS - scoreN).toFixed(2)}). ${evidenceS}; ${evidenceN}`,
        debug: { scoreS, scoreN, evidenceS, evidenceN },
      };
    }
    if (scoreN - scoreS >= MARGIN) {
      return {
        label: "Normal",
        confidence: bestN,
        reason: `Normal score higher (Δ=${(scoreN - scoreS).toFixed(2)}). ${evidenceN}; ${evidenceS}`,
        debug: { scoreS, scoreN, evidenceS, evidenceN },
      };
    }

    return {
      label: "Uncertain",
      confidence: Math.max(bestS, bestN),
      reason: `Too close to call. ${evidenceS}; ${evidenceN}`,
      debug: { scoreS, scoreN, evidenceS, evidenceN },
    };
  }

  // 3) No evidence at all
  return {
    label: "Uncertain",
    confidence: 0,
    reason: `No “scoliosis spine” or “normal spine” detections ≥ ${Math.round(MIN_CONF * 100)}%`,
    debug: { scoreS, scoreN, evidenceS, evidenceN },
  };
}

type ParamsMaybePromise = { id?: string } | Promise<{ id?: string }>;

async function getId(params: ParamsMaybePromise): Promise<string> {
  const resolved = typeof (params as any)?.then === "function" ? await (params as any) : params;
  const id = (resolved as any)?.id;
  if (typeof id !== "string" || id.length === 0) notFound();
  return id;
}

export default async function ScanPage({ params }: { params: ParamsMaybePromise }) {
  const id = await getId(params);
  const { userId } = await auth();
  if (!userId) return null;

  console.log("SCAN ROUTE PARAM id =", id);

  const scan = await prisma.scan.findFirst({
    where: { id, userId },
    include: { detections: true },
  });

  if (!scan) return notFound();
  if (scan.id !== id) return notFound();

  const summary = summarizeScan(scan.detections);

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold">Scan {scan.id}</h1>

        <p className="text-sm text-muted-foreground">URL id: {id}</p>
        <p>Created: {scan.createdAt.toISOString()}</p>
        <p>Image Key: {scan.originalImageUrl ?? "(none yet)"}</p>

        {/* Status (this is how we track progress) */}
        <p>
          Status: <span className="font-semibold">{scan.status}</span>
        </p>

        {/* Helpful message when FAILED */}
        {scan.status === "FAILED" && (
          <p className="text-sm text-red-600">
            Inference failed. You can try clicking “Retry inference”.
          </p>
        )}

        <RunInferenceButton scanId={scan.id} status={scan.status} />

        {/* Show the image from S3 */}
        {scan.originalImageUrl ? (
          <S3Image scanId={scan.id} detections={scan.detections} />
        ) : (
          <p className="text-sm text-muted-foreground">No image uploaded yet.</p>
        )}

        {/* Model summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="rounded-full border px-3 py-1 text-sm">
              Model suggests: <strong>{summary.label}</strong>
              {summary.confidence > 0 ? ` (${Math.round(summary.confidence * 100)}%)` : ""}
            </span>
            <span className="text-sm text-muted-foreground">{summary.reason}</span>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: This is a model output for demo/education and is not medical advice.
          </p>
        </div>

        {/* Detections list */}
        {scan.detections.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Detections</h2>
            <ul className="space-y-2">
              {scan.detections.map((d) => (
                <li key={d.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>{d.className}</span>
                    <span className="text-muted-foreground">
                      {Math.round(d.confidence * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : scan.status === "RUNNING" ? (
          <p className="text-sm text-muted-foreground">
            Inference is running… this page will update automatically.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No detections yet. Click “Run inference”.
          </p>
        )}
      </div>
    </div>
  );
}