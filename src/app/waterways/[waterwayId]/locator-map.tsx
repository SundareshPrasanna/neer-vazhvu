"use client";

import { memo, useEffect, useState } from "react";
import type { WaterwayLocatorAnchor } from "@/lib/waterways/types";

/**
 * The "you are here" inset: the waterway's true shape drawn from its
 * served centerline, the active span highlighted, and a few recognizable
 * places labelled along it - so a reach or chapter never loses its city
 * anchor. Pure SVG from data the page already ships; no map library.
 * Anchors are curated per waterway (locator_anchors in reaches.json).
 */

type Pt = [number, number];
type Line = { pts: Pt[]; lengthKm: number };
// Promise-level cache: many locators mount at once (one per chapter),
// and caching the in-flight promise keeps that to ONE centerline fetch.
const cache: Record<string, Promise<Line>> = {};

function loadLine(waterwayId: string): Promise<Line> {
  cache[waterwayId] ??= fetch(
    `/data/waterways/${waterwayId}/centerline.geojson`
  )
    .then((r) => r.json())
    .then((d) => {
      const f = d.features[0];
      const raw: Pt[] = f.geometry.coordinates;
      const step = Math.max(1, Math.floor(raw.length / 150));
      return {
        pts: raw.filter(
          (_: Pt, i: number) => i % step === 0 || i === raw.length - 1
        ),
        lengthKm: f.properties.length_km as number,
      };
    });
  return cache[waterwayId];
}

export const LocatorMap = memo(function LocatorMap({
  waterwayId,
  span,
  anchors,
}: {
  waterwayId: string;
  /** Highlighted chainage range, or null for the whole alignment. */
  span: [number, number] | null;
  anchors: WaterwayLocatorAnchor[];
}) {
  const [line, setLine] = useState<Line | null>(null);
  useEffect(() => {
    let live = true;
    loadLine(waterwayId)
      .then((l) => {
        if (live) setLine(l);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [waterwayId]);

  if (!line) return <div aria-hidden className="h-28 w-40 shrink-0" />;

  const { pts, lengthKm } = line;
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const dx = (Math.max(...lons) - Math.min(...lons)) * kx;
  const dy = Math.max(...lats) - Math.min(...lats);
  const tall = dy > dx;
  // Inner drawing box; generous padding carries the labels.
  const PAD_X = tall ? 52 : 30;
  const PAD_Y = tall ? 12 : 16;
  const IW = tall ? 44 : 150;
  const IH = tall ? 116 : 44;
  const W = IW + PAD_X * 2;
  const H = IH + PAD_Y * 2;
  const scale = Math.min(IW / dx, IH / dy);
  const x0 = Math.min(...lons);
  const y1 = Math.max(...lats);
  const toXY = (p: Pt): [number, number] => [
    PAD_X + ((p[0] - x0) * kx * scale + (IW - dx * scale) / 2),
    PAD_Y + ((y1 - p[1]) * scale + (IH - dy * scale) / 2),
  ];
  const idx = (km: number) =>
    Math.max(0, Math.min(pts.length - 1, Math.round((km / lengthKm) * (pts.length - 1))));
  const poly = (ps: Pt[]) => ps.map((p) => toXY(p).join(",")).join(" ");
  const seg = span ? pts.slice(idx(span[0]), idx(span[1]) + 1) : [];
  const mid = span ? toXY(pts[idx((span[0] + span[1]) / 2)]) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={tall ? "h-36 w-auto shrink-0" : "h-24 w-auto shrink-0"}
      role="img"
      aria-label={
        span
          ? `Locator: km ${span[0]} to ${span[1]} of the alignment`
          : "Locator: the full alignment"
      }
    >
      <polyline
        points={poly(pts)}
        fill="none"
        strokeWidth={1.5}
        className="stroke-muted-foreground/40"
      />
      {seg.length > 1 && (
        <polyline
          points={poly(seg)}
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          className="stroke-primary"
        />
      )}
      {mid && <circle cx={mid[0]} cy={mid[1]} r={3} className="fill-primary" />}
      {anchors.map((a, i) => {
        const [ax, ay] = toXY(pts[idx(a.km)]);
        // Wide mode: alternate labels above/below the line; labels near
        // either edge anchor outward so end labels never crowd inward.
        const nearRight = ax > W - 30;
        const nearLeft = ax < 30;
        return (
          <g key={a.label}>
            <circle cx={ax} cy={ay} r={1.6} className="fill-muted-foreground" />
            {tall ? (
              <text
                x={ax + 5}
                y={ay + 2.5}
                fontSize={7.5}
                className="fill-muted-foreground"
              >
                {a.label}
              </text>
            ) : (
              <text
                x={nearRight ? W - 2 : nearLeft ? 2 : ax}
                y={i % 2 ? ay - 6 : ay + 12}
                fontSize={7.5}
                textAnchor={nearRight ? "end" : nearLeft ? "start" : "middle"}
                className="fill-muted-foreground"
              >
                {a.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});
