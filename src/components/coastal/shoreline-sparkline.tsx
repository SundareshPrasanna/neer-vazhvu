"use client";

import { useState } from "react";

/**
 * Tiny inline-SVG chart of net shoreline movement (m, vs the earliest epoch)
 * over the measured years. No chart dependency. Erosion (downward) is red,
 * accretion (upward) blue; a dashed zero line marks the starting shoreline.
 * Hover (or tap) a point to read its year, the cumulative shoreline lost/gained
 * since the baseline, and the erosion/accretion rate over that period.
 */
export function ShorelineSparkline({
  series,
  width = 248,
  height = 108,
}: {
  series: [number, number][];
  width?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!series || series.length < 2) return null;

  const padX = 8;
  const padTop = 10;
  const padBottom = 16;
  const years = series.map((p) => p[0]);
  const vals = series.map((p) => p[1]);
  const minY = Math.min(0, ...vals);
  const maxY = Math.max(0, ...vals);
  const spanY = maxY - minY || 1;
  const minX = Math.min(...years);
  const spanX = Math.max(...years) - minX || 1;

  const x = (yr: number) => padX + ((yr - minX) / spanX) * (width - 2 * padX);
  const y = (v: number) => padTop + (1 - (v - minY) / spanY) * (height - padTop - padBottom);

  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1];
  const stroke = last <= -0.5 ? "#dc2626" : last >= 0.5 ? "#2563eb" : "#64748b";

  // Build the hover readout: year, cumulative lost/gained, and the period rate
  // (since the previous epoch).
  const lines: string[] = [];
  if (hover != null) {
    const [yr, cum] = series[hover];
    lines.push(String(yr));
    const lost = Math.round(Math.abs(cum));
    lines.push(cum < 0 ? `${lost} m lost since ${years[0]}` : cum > 0 ? `${lost} m gained since ${years[0]}` : "at baseline");
    if (hover > 0) {
      const [py, pv] = series[hover - 1];
      const rate = (cum - pv) / (yr - py);
      lines.push(`${rate > 0 ? "+" : ""}${rate.toFixed(1)} m/yr (${py}-${yr})`);
    }
  }
  const boxW = Math.max(96, ...lines.map((l) => l.length * 5.6));
  const boxH = lines.length * 11 + 6;
  const hx = hover != null ? x(series[hover][0]) : 0;
  const boxX = Math.min(Math.max(hx - boxW / 2, 2), width - boxW - 2);

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible touch-none"
      role="img"
      aria-label="Shoreline movement over time"
    >
      {/* zero baseline */}
      <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={1} />
      <text x={padX} y={y(0) - 2} fontSize="8" fill="#94a3b8">
        baseline shore
      </text>
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* hover guide + multi-line readout */}
      {hover != null && (
        <>
          <line x1={hx} x2={hx} y1={padTop} y2={height - padBottom} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />
          <rect x={boxX} y={1} width={boxW} height={boxH} rx={3} fill="#0f172a" opacity={0.92} />
          {lines.map((l, i) => (
            <text
              key={i}
              x={boxX + boxW / 2}
              y={12 + i * 11}
              fontSize={i === 0 ? 9.5 : 9}
              fontWeight={i === 0 ? 700 : 400}
              fill="#ffffff"
              textAnchor="middle"
            >
              {l}
            </text>
          ))}
        </>
      )}

      {/* visible points + invisible larger hit targets */}
      {series.map((p, i) => (
        <g key={p[0]}>
          <circle cx={x(p[0])} cy={y(p[1])} r={hover === i ? 3.2 : 1.8} fill={stroke} />
          <circle
            cx={x(p[0])}
            cy={y(p[1])}
            r={9}
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          />
        </g>
      ))}

      {/* endpoint year labels (hidden while hovering to avoid clutter) */}
      {hover == null && (
        <>
          <text x={x(years[0])} y={height - 4} fontSize="8" fill="#94a3b8" textAnchor="start">
            {years[0]}
          </text>
          <text x={x(years[years.length - 1])} y={height - 4} fontSize="8" fill="#94a3b8" textAnchor="end">
            {years[years.length - 1]}
          </text>
        </>
      )}
    </svg>
  );
}
