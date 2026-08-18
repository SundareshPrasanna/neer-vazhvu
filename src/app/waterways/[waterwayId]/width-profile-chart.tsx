"use client";

import { useEffect, useState } from "react";
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

export function WidthProfileChart({ waterwayId }: { waterwayId: string }) {
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

  const data = points.map((p) => ({
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
              domain={[0, 74.5]}
              tickCount={8}
              tick={{ fontSize: 11 }}
              label={{
                value: "km from Ennore",
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
              fill="#dc2626"
              fillOpacity={0.07}
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
        polygons (2026 snapshot). Shaded band: the MRTS city reach. Readings
        above {DISPLAY_CAP_M} m (backwaters) are capped for display; gaps are
        unmeasured, not zero.
      </figcaption>
    </figure>
  );
}
