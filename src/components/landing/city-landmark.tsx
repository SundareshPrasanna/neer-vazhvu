/**
 * Per-city landmark line-art for the landing-page city cards. The art is
 * original, simple line work (license-safe for the open-source repo) drawn
 * as white strokes over the city's accent gradient. The card banner is
 * structured so a licensed photograph can replace the gradient + SVG later
 * without touching the card layout.
 *
 * viewBox is a consistent 0 0 200 80; landmarks sit on the baseline (~y=66)
 * so they read as a skyline silhouette along the bottom of the banner.
 */

/** Per-city accent gradient (Tailwind classes) for the card banner. */
export const CITY_ACCENT: Record<string, string> = {
  chennai: "from-cyan-500 to-blue-600",
  madurai: "from-amber-500 to-orange-600",
  bangalore: "from-emerald-500 to-teal-600",
  mumbai: "from-indigo-500 to-violet-600",
  delhi: "from-rose-500 to-red-600",
  kolkata: "from-fuchsia-500 to-pink-600",
  gurugram: "from-lime-500 to-emerald-600",
};

export const DEFAULT_ACCENT = "from-slate-500 to-slate-600";

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Chennai - Marina Beach lighthouse over waves. */
function ChennaiLighthouse() {
  return (
    <g {...strokeProps}>
      {/* waves */}
      <path d="M0 72 q12 -6 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" opacity={0.7} />
      {/* tower */}
      <path d="M92 66 L96 30 L104 30 L108 66" />
      <line x1="93.2" y1="54" x2="106.8" y2="54" />
      <line x1="94.2" y1="42" x2="105.8" y2="42" />
      {/* lantern room + dome + light */}
      <rect x="95" y="22" width="10" height="8" />
      <path d="M95 22 q5 -7 10 0" />
      <line x1="100" y1="15" x2="100" y2="10" />
      {/* light rays */}
      <path d="M88 17 l-6 -3 M112 17 l6 -3" opacity={0.7} />
    </g>
  );
}

/** Madurai - Meenakshi Amman temple gopuram (stepped tiered tower). */
function MaduraiGopuram() {
  return (
    <g {...strokeProps}>
      <path d="M70 66 L130 66 L127 58 L73 58 Z" />
      <path d="M75 58 L125 58 L122 50 L78 50 Z" />
      <path d="M80 50 L120 50 L117.5 42 L82.5 42 Z" />
      <path d="M85 42 L115 42 L113 34 L87 34 Z" />
      <path d="M89 34 L111 34 L109.5 28 L90.5 28 Z" />
      {/* crowning kalasams */}
      <path d="M91 28 q2.5 -5 5 0 q2.5 -5 5 0 q2.5 -5 5 0 q2.5 -5 5 0" opacity={0.85} />
      <line x1="100" y1="28" x2="100" y2="66" opacity={0.6} />
    </g>
  );
}

/** Bengaluru - Vidhana Soudha (central dome over a columned base). */
function BangaloreVidhanaSoudha() {
  return (
    <g {...strokeProps}>
      {/* base */}
      <rect x="58" y="48" width="84" height="18" />
      {/* columns */}
      <path d="M66 48 V66 M76 48 V66 M124 48 V66 M134 48 V66" opacity={0.6} />
      {/* central drum + dome */}
      <rect x="90" y="38" width="20" height="10" />
      <path d="M89 38 q11 -18 22 0" />
      <line x1="100" y1="20" x2="100" y2="15" />
      {/* flanking small domes */}
      <path d="M62 48 q4 -7 8 0" opacity={0.85} />
      <path d="M130 48 q4 -7 8 0" opacity={0.85} />
    </g>
  );
}

/** Mumbai - Gateway of India (central arch flanked by smaller arches + domes). */
function MumbaiGateway() {
  return (
    <g {...strokeProps}>
      <line x1="56" y1="66" x2="144" y2="66" />
      {/* central arch */}
      <path d="M86 66 L86 42 Q100 26 114 42 L114 66" />
      {/* central dome */}
      <path d="M88 40 Q100 22 112 40" />
      <line x1="100" y1="26" x2="100" y2="21" />
      {/* side arches */}
      <path d="M64 66 L64 48 Q71 40 78 48 L78 66" />
      <path d="M122 66 L122 48 Q129 40 136 48 L136 66" />
      {/* corner minarets */}
      <path d="M64 48 q3.5 -6 7 0 M129 48 q3.5 -6 7 0" opacity={0.85} />
    </g>
  );
}

/** Delhi - India Gate (single triumphal arch with a cornice block). */
function DelhiIndiaGate() {
  return (
    <g {...strokeProps}>
      <line x1="62" y1="66" x2="138" y2="66" />
      <path d="M80 66 L80 34 Q100 18 120 34 L120 66" />
      <rect x="76" y="24" width="48" height="9" />
      {/* shallow top step */}
      <path d="M86 24 L86 20 L114 20 L114 24" opacity={0.85} />
    </g>
  );
}

/** Kolkata - Howrah Bridge (cantilever towers, deck, cross-bracing). */
function KolkataHowrah() {
  return (
    <g {...strokeProps}>
      {/* deck */}
      <line x1="38" y1="60" x2="162" y2="60" />
      <line x1="38" y1="64" x2="162" y2="64" opacity={0.6} />
      {/* towers */}
      <path d="M70 60 L70 26 L80 26 L80 60" />
      <path d="M120 60 L120 26 L130 26 L130 60" />
      {/* top chord */}
      <line x1="70" y1="26" x2="130" y2="26" />
      {/* cantilever cross-bracing */}
      <path d="M80 34 L120 52 M80 52 L120 34" opacity={0.7} />
      {/* side suspension to anchors */}
      <path d="M70 30 L44 60 M130 30 L156 60" opacity={0.7} />
    </g>
  );
}

const LANDMARKS: Record<string, () => React.JSX.Element> = {
  chennai: ChennaiLighthouse,
  madurai: MaduraiGopuram,
  bangalore: BangaloreVidhanaSoudha,
  mumbai: MumbaiGateway,
  delhi: DelhiIndiaGate,
  kolkata: KolkataHowrah,
};

/** Generic skyline fallback for any city without bespoke art. */
function GenericSkyline() {
  return (
    <g {...strokeProps}>
      <line x1="40" y1="66" x2="160" y2="66" />
      <path d="M60 66 V46 H74 V66 M84 66 V36 H96 V66 M106 66 V50 H120 V66 M128 66 V42 H140 V66" />
    </g>
  );
}

export function CityLandmark({ cityId, className }: { cityId: string; className?: string }) {
  const Art = LANDMARKS[cityId] ?? GenericSkyline;
  return (
    <svg
      viewBox="0 0 200 80"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className={className}
    >
      <Art />
    </svg>
  );
}
