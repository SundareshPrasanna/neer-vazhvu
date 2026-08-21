"use client";

import { memo, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The long profile: measured water-surface width over all 74.5 km.
 * Linear axes on purpose (a log axis with null/zero gaps renders blank in
 * recharts). Gaps stay gaps: unmeasured transects are not interpolated.
 * Open-water readings (backwaters) are capped for display so the city
 * squeeze stays legible; the cap is stated in the caption.
 */
interface ProfilePoint {
  km: number;
  w: number | null;
  flag: string;
}

const DISPLAY_CAP_M = 160;

export const WidthProfileChart = memo(function WidthProfileChart({
  waterwayId,
  xLabel = "km along the alignment",
}: {
  waterwayId: string;
  xLabel?: string;
}) {
  const [points, setPoints] = useState<ProfilePoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/data/waterways/${waterwayId}/width-profile.json`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setPoints(j.profile as ProfilePoint[]);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [waterwayId]);

  if (failed) {
    return (
      <p className="text-sm text-muted-foreground">
        Width profile unavailable.
      </p>
    );
  }
  if (!points) {
    return (
      <div className="h-56 animate-pulse rounded-lg bg-muted/50" aria-hidden />
    );
  }

  // Decimate for display: the chart is ~560 px wide, so more than ~500
  // rendered points is pure DOM weight. Preserve gaps (nulls survive).
  const step = Math.max(1, Math.ceil(points.length / 500));
  const shown = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const maxKm = Math.ceil(points[points.length - 1].km * 10) / 10;
  const data = shown.map((p) => ({
    km: p.km,
    w:
      p.w == null
        ? null
        : p.flag === "OPEN_WATER"
          ? DISPLAY_CAP_M
          : Math.min(p.w, DISPLAY_CAP_M),
  }));

  return (
    <figure>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="km"
              type="number"
              domain={[0, maxKm]}
              tickCount={8}
              tick={{ fontSize: 11 }}
              label={{
                value: xLabel,
                position: "insideBottomRight",
                offset: -2,
                fontSize: 11,
              }}
            />
            <YAxis
              domain={[0, DISPLAY_CAP_M]}
              tick={{ fontSize: 11 }}
              width={34}
            />
            {/* The MRTS city squeeze, km ~20.5-32 */}
            <ReferenceArea
              x1={20.5}
              x2={32}
              fill="#94a3b8"
              fillOpacity={0.18}
              label={{
                value: "MRTS reach",
                position: "insideTop",
                fontSize: 10,
                fill: "#94a3b8",
              }}
            />
            <Tooltip
              formatter={(v) =>
                typeof v === "number"
                  ? v >= DISPLAY_CAP_M
                    ? ["open water", "width"]
                    : [`${v} m`, "width"]
                  : ["-", "width"]
              }
              labelFormatter={(km) => `km ${km}`}
            />
            <Area
              dataKey="w"
              type="monotone"
              connectNulls={false}
              stroke="#0e7490"
              fill="#0e7490"
              fillOpacity={0.25}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-muted-foreground">
        Water-surface width every 200 m, measured from OpenStreetMap water
        polygons (contributor-traced; the polygons carry edits from 2018 to
        March 2026, most since 2022; snapshot Jul 2026). Shaded band: the MRTS city reach (km 20.5\u201332). Readings
        above {DISPLAY_CAP_M} m (backwaters) are capped for display; gaps are
        unmeasured, not zero.
      </figcaption>
    </figure>
  );
});
