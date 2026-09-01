export interface MixBarShare {
  key: string;
  label: string;
  percent: number;
  /** The absolute quantity behind the share, already formatted. */
  detail?: string;
}

/**
 * One stacked bar for a source mix (irrigation by source, drinking water by
 * category). Server-rendered SVG: no chart library for four numbers.
 *
 * Colour follows the entity in a fixed order (first three slots of the
 * platform's categorical set, validated in both modes); a fourth or later
 * share is the neutral "other" and is always labelled in the legend, so
 * identity never rests on colour alone.
 */
const FILLS = [
  "fill-[#2a78d6] dark:fill-[#3987e5]",
  "fill-[#eb6834] dark:fill-[#d95926]",
  "fill-[#1baf7a] dark:fill-[#199e70]",
  "fill-slate-400 dark:fill-slate-500",
];
const SWATCHES = [
  "bg-[#2a78d6] dark:bg-[#3987e5]",
  "bg-[#eb6834] dark:bg-[#d95926]",
  "bg-[#1baf7a] dark:bg-[#199e70]",
  "bg-slate-400 dark:bg-slate-500",
];

export function AtlasMixBar({ title, shares, caption }: { title: string; shares: MixBarShare[]; caption?: string }) {
  const visible = shares.filter((s) => s.percent > 0);
  const segments = visible.map((share, index) => ({
    ...share,
    x: visible.slice(0, index).reduce((sum, prior) => sum + prior.percent, 0),
    index: Math.min(index, FILLS.length - 1),
  }));
  return (
    <figure>
      <figcaption className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</figcaption>
      <svg
        role="img"
        aria-label={`${title}: ${visible.map((s) => `${s.label} ${s.percent}%`).join(", ")}`}
        width="100%"
        height="28"
        className="mt-2 block"
      >
        {segments.map((segment) => (
          <g key={segment.key}>
            <rect
              x={`${segment.x}%`}
              y="0"
              width={`${Math.max(0, segment.percent - 0.4)}%`}
              height="28"
              rx="3"
              className={FILLS[segment.index]}
            />
            {segment.percent >= 12 ? (
              <text
                x={`${segment.x + segment.percent / 2}%`}
                y="18"
                textAnchor="middle"
                className="fill-white text-[11px] font-semibold"
              >
                {Math.round(segment.percent)}%
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        {shares.map((share, index) => (
          <li key={share.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${SWATCHES[Math.min(index, SWATCHES.length - 1)]}`} />
            <span className="text-slate-800 dark:text-slate-200">{share.label}</span>
            <span className="tabular-nums">{share.percent.toFixed(1)}%</span>
            {share.detail ? <span className="text-slate-400 dark:text-slate-500">({share.detail})</span> : null}
          </li>
        ))}
      </ul>
      {caption ? <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{caption}</p> : null}
    </figure>
  );
}
