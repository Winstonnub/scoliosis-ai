"use client";

import { useEffect, useRef } from "react";

type Detection = {
  id: string;
  className: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function BBoxOverlay({
  imageUrl,
  detections,
}: {
  imageUrl: string;
  detections: Detection[];
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function redraw() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas should match the displayed image size (CSS pixels)
    const rect = img.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scale from original image pixels -> displayed pixels
    const sx = canvas.width / img.naturalWidth;
    const sy = canvas.height / img.naturalHeight;

    // Draw each box
    ctx.lineWidth = 2;

    for (const d of detections) {
      const x = d.x1 * sx;
      const y = d.y1 * sy;
      const w = (d.x2 - d.x1) * sx;
      const h = (d.y2 - d.y1) * sy;

      // Box
      ctx.strokeStyle = "lime";
      ctx.strokeRect(x, y, w, h);

      // Label background
      const label = `${d.className} ${Math.round(d.confidence * 100)}%`;
      ctx.font = "12px sans-serif";
      const textW = ctx.measureText(label).width;
      const pad = 4;

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, Math.max(0, y - 16), textW + pad * 2, 16);

      // Label text
      ctx.fillStyle = "white";
      ctx.fillText(label, x + pad, Math.max(12, y - 4));
    }
  }

  // Redraw when image loads or detections change
  useEffect(() => {
    redraw();
    // redraw on window resize
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, detections.length]);

  return (
    <div className="relative w-full overflow-hidden rounded-md border">
      <img
        ref={imgRef}
        src={imageUrl}
        alt="X-ray"
        className="block w-full h-auto"
        onLoad={redraw}
      />

      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-0 top-0 h-full w-full"
      />
    </div>
  );
}