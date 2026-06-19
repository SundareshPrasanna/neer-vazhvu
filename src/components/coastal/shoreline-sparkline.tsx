"use client";

/**
 * Tiny inline-SVG chart of net shoreline movement (m, vs the earliest epoch)
 * over the measured years. No chart dependency. Erosion (downward) is red,
 * accretion (upward) blue; a dashed zero line marks the starting shoreline.
 */
export function ShorelineSparkline({
  series,
  width = 248,
  height = 96,
}: {
  series: [number, number][];
  width?: number;
  height?: number;
}) {
  if (!series || series.length < 2) return null;

  const padX = 6;
  const padTop = 8;
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

  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="Shoreline movement over time">
      {/* zero baseline */}
      <line x1={padX} x2={width - padX} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth={1} />
      <text x={padX} y={y(0) - 2} fontSize="8" fill="#94a3b8">
        baseline shore
      </text>
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {series.map((p) => (
        <circle key={p[0]} cx={x(p[0])} cy={y(p[1])} r={1.8} fill={stroke} />
      ))}
      {/* endpoint year labels */}
      <text x={x(years[0])} y={height - 4} fontSize="8" fill="#94a3b8" textAnchor="start">
        {years[0]}
      </text>
      <text x={x(years[years.length - 1])} y={height - 4} fontSize="8" fill="#94a3b8" textAnchor="end">
        {years[years.length - 1]}
      </text>
    </svg>
  );
}
