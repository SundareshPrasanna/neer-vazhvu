"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { btn } from "./ui";

/** Rub over a face, number plate or house name to pixelate it before the photo leaves the phone. */
export function PhotoBlur({ src, onDone, onClose }: { src: string; onDone: (file: File) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const blocky = useRef<HTMLCanvasElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [changed, setChanged] = useState(false);

  const reset = () => {
    const c = canvas.current;
    if (c && image.current) c.getContext("2d")!.drawImage(image.current, 0, 0);
    setChanged(false);
  };

  useEffect(() => {
    box.current?.focus();
    const img = new Image();
    img.onload = () => {
      const c = canvas.current;
      if (!c) return;
      image.current = img;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d")!.drawImage(img, 0, 0);
      // Blocks of 1/32 of the long side: too coarse to recognise a face or read a plate.
      const block = Math.max(12, Math.round(Math.max(c.width, c.height) / 32));
      const small = document.createElement("canvas");
      small.width = Math.ceil(c.width / block);
      small.height = Math.ceil(c.height / block);
      small.getContext("2d")!.drawImage(img, 0, 0, small.width, small.height);
      const big = document.createElement("canvas");
      big.width = c.width;
      big.height = c.height;
      const ctx = big.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, big.width, big.height);
      blocky.current = big;
    };
    img.src = src;
  }, [src]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current;
    if (!c || !blocky.current) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * c.width) / rect.width;
    const y = ((e.clientY - rect.top) * c.height) / rect.height;
    const r = Math.max(c.width, c.height) / 20;
    const from = last.current ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / (r / 2)));
    const ctx = c.getContext("2d")!;
    for (let i = 1; i <= steps; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(from.x + ((x - from.x) * i) / steps, from.y + ((y - from.y) * i) / steps, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(blocky.current, 0, 0);
      ctx.restore();
    }
    last.current = { x, y };
    setChanged(true);
  };

  const done = () =>
    canvas.current?.toBlob((b) => (b ? onDone(new File([b], "photo.jpg", { type: "image/jpeg" })) : onClose()), "image/jpeg", 0.85);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label="Blur part of the photo"
      tabIndex={-1}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-slate-950/90 p-4 outline-none"
    >
      <p className="max-w-md text-center text-sm text-white">Rub your finger over faces, vehicle number plates and house names or numbers.</p>
      <canvas
        ref={canvas}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = null;
          paint(e);
        }}
        onPointerMove={(e) => e.buttons > 0 && paint(e)}
        onPointerUp={() => (last.current = null)}
        className="h-auto max-h-[65vh] w-auto max-w-full cursor-crosshair touch-none rounded-lg"
      />
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} disabled={!changed} className={`${btn("quiet", "md")} text-white! hover:bg-white/10!`}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Start again
        </button>
        <button type="button" onClick={onClose} className={`${btn("quiet", "md")} text-white! hover:bg-white/10!`}>
          Cancel
        </button>
        <button type="button" onClick={done} disabled={!changed} className={btn("primary", "md")}>
          Use this photo
        </button>
      </div>
    </div>
  );
}
