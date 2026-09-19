/**
 * Per-district line-art for the Atlas district cards and the district page
 * header: the rural twin of src/components/landing/city-landmark.tsx. Each
 * district gets its own mark, chosen for the water that defines it (a dam, a
 * confluence, a moat, a plateau of tanks) with the one form a reader from
 * that district recognises, drawn as white strokes over the district's own
 * accent gradient. The art is original line work, so it carries no licence
 * question; a licensed photograph could replace gradient + mark later without
 * touching the card layout.
 *
 * viewBox is a consistent 0 0 200 80; marks sit on the baseline (~y=66) so
 * they read as a horizon along the bottom of the banner. Keyed by scopeId
 * (tn-salem, mh-satara); a district without bespoke art falls back to the
 * generic canals-and-tanks mark.
 */

/** Per-district accent gradient (Tailwind classes) for the card banner. */
export const DISTRICT_ACCENT: Record<string, string> = {
  "tn-thanjavur": "from-emerald-500 to-teal-700",
  "tn-tiruchirappalli": "from-orange-500 to-amber-700",
  "tn-salem": "from-sky-500 to-indigo-700",
  "tn-tirupathur": "from-lime-500 to-emerald-700",
  "tn-erode": "from-teal-500 to-cyan-700",
  "tn-namakkal": "from-amber-500 to-orange-700",
  "tn-karur": "from-cyan-500 to-blue-700",
  "tn-tiruppur": "from-fuchsia-500 to-violet-700",
  "tn-vellore": "from-rose-500 to-red-700",
  "tn-ranipet": "from-yellow-500 to-amber-700",
  "tn-dindigul": "from-green-500 to-emerald-700",
  "tn-tiruvallur": "from-sky-500 to-cyan-700",
  "tn-krishnagiri": "from-yellow-600 to-green-800",
  "mh-satara": "from-violet-500 to-purple-700",
  "mh-ahilyanagar": "from-orange-500 to-red-700",
  "mh-kolhapur": "from-pink-500 to-rose-700",
  "ka-kolar": "from-amber-400 to-stone-700",
};

/** The gradient every district shared before the per-district marks. */
export const DEFAULT_DISTRICT_ACCENT = "from-teal-500 to-emerald-700";

export function districtAccent(scopeId: string): string {
  return DISTRICT_ACCENT[scopeId] ?? DEFAULT_DISTRICT_ACCENT;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Thanjavur - the Brihadisvara vimana over the delta's branching channels. */
function ThanjavurDelta() {
  return (
    <g {...strokeProps}>
      {/* the delta: one river fanning into channels */}
      <path d="M0 50 C 30 50, 50 58, 80 62 S 130 66, 200 70" opacity={0.7} />
      <path d="M40 54 C 70 62, 100 72, 200 76" opacity={0.45} />
      <path d="M90 63 C 120 60, 150 58, 200 62" opacity={0.45} />
      {/* the vimana: a tall tapering tower on a plinth */}
      <path d="M112 52 H156 V46 H112 Z" />
      <path d="M116 46 L121 16 H147 L152 46" />
      <path d="M119 40 H149 M121 33 H147 M123 26 H145" opacity={0.6} />
      <path d="M125 16 L134 6 L143 16" />
      <line x1="134" y1="6" x2="134" y2="2" />
    </g>
  );
}

/** Tiruchirappalli - the Rockfort above the Cauvery. */
function TiruchirappalliRockfort() {
  return (
    <g {...strokeProps}>
      <path d="M0 68 q14 -5 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0" opacity={0.7} />
      {/* the rock */}
      <path d="M62 62 C 70 44, 82 30, 100 26 C 118 30, 130 44, 138 62 Z" />
      {/* the stepped path up */}
      <path d="M76 58 L82 50 L90 46 L96 38" opacity={0.6} />
      {/* the small temple on the summit */}
      <path d="M94 26 V19 H106 V26" />
      <path d="M96 19 L100 12 L104 19" />
    </g>
  );
}

/** Salem - the Mettur dam wall with its spillway gates, the Shevaroys behind. */
function SalemMettur() {
  return (
    <g {...strokeProps}>
      {/* hills */}
      <path d="M0 42 L28 24 L52 40 L76 20 L100 38" opacity={0.5} />
      {/* the dam wall */}
      <path d="M40 66 V44 H172 V66" />
      <path d="M40 44 L46 40 H166 L172 44" opacity={0.85} />
      {/* spillway gates */}
      <path d="M56 44 V56 M76 44 V56 M96 44 V56 M116 44 V56 M136 44 V56 M156 44 V56" opacity={0.7} />
      <path d="M46 56 H166" opacity={0.7} />
      {/* the reservoir behind, the river released in front */}
      <path d="M108 36 q8 -3 16 0 t16 0 t16 0 t16 0" opacity={0.5} />
      <path d="M60 72 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0" opacity={0.7} />
    </g>
  );
}

/** Tirupathur - the Yelagiri hills over the Palar's dry sand bed. */
function TirupathurPalar() {
  return (
    <g {...strokeProps}>
      <path d="M20 46 L52 22 L74 38 L100 16 L128 40 L150 28 L180 46" />
      <path d="M92 30 L100 24 L108 32" opacity={0.6} />
      {/* the dry bed: banks with sand ripples, no water line */}
      <path d="M0 58 H200" opacity={0.7} />
      <path d="M0 74 H200" opacity={0.7} />
      <path d="M14 66 h10 M40 68 h10 M66 65 h10 M92 68 h10 M118 65 h10 M144 68 h10 M170 65 h10" opacity={0.5} />
    </g>
  );
}

/** Erode - the Bhavanisagar earthen dam and the canal it feeds. */
function ErodeBhavanisagar() {
  return (
    <g {...strokeProps}>
      {/* the long earthen embankment */}
      <path d="M0 62 L40 40 H160 L200 62" />
      <path d="M40 40 H160" opacity={0.6} />
      {/* the spillway tower */}
      <path d="M92 40 V26 H108 V40" />
      <path d="M96 30 H104" opacity={0.6} />
      {/* the reservoir behind */}
      <path d="M60 34 q7 -3 14 0 t14 0 t14 0 t14 0 t14 0" opacity={0.5} />
      {/* the canal in front */}
      <path d="M0 72 H200" opacity={0.75} />
      <path d="M0 76 H200" opacity={0.4} />
    </g>
  );
}

/** Namakkal - the fort rock over its tank. */
function NamakkalRock() {
  return (
    <g {...strokeProps}>
      {/* the monolith */}
      <path d="M66 66 C 68 44, 80 28, 100 24 C 120 28, 132 44, 134 66" />
      {/* fort wall along the rim */}
      <path d="M78 36 H122" opacity={0.7} />
      <path d="M82 36 V31 H88 V36 M96 36 V31 H104 V36 M112 36 V31 H118 V36" opacity={0.7} />
      {/* the tank at its foot */}
      <path d="M20 72 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" opacity={0.7} />
      <path d="M14 66 H186" opacity={0.35} />
    </g>
  );
}

/** Karur - the Amaravathi meeting the Cauvery under the town bridge. */
function KarurConfluence() {
  return (
    <g {...strokeProps}>
      {/* the Cauvery */}
      <path d="M0 58 C 40 54, 80 62, 120 60 S 170 56, 200 60" opacity={0.8} />
      <path d="M0 66 C 40 62, 80 70, 120 68 S 170 64, 200 68" opacity={0.5} />
      {/* the Amaravathi joining from the left bank */}
      <path d="M60 14 C 66 30, 80 46, 110 60" opacity={0.8} />
      <path d="M72 14 C 78 30, 92 46, 120 62" opacity={0.5} />
      {/* the bridge */}
      <path d="M96 40 H164" />
      <path d="M104 40 V58 M122 40 V60 M140 40 V58 M158 40 V58" opacity={0.6} />
    </g>
  );
}

/** Tiruppur - yarn on the Noyyal: spools and bobbins beside the river. */
function TiruppurNoyyal() {
  return (
    <g {...strokeProps}>
      {/* the Noyyal */}
      <path d="M0 72 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity={0.7} />
      {/* three spools */}
      <path d="M60 62 V34 H76 V62 M58 34 H78 M58 62 H78" />
      <path d="M92 62 V26 H108 V62 M90 26 H110 M90 62 H110" />
      <path d="M124 62 V40 H140 V62 M122 40 H142 M122 62 H142" />
      {/* the thread */}
      <path d="M62 40 H74 M62 48 H74 M94 34 H106 M94 44 H106 M94 54 H106 M126 46 H138 M126 54 H138" opacity={0.5} />
    </g>
  );
}

/** Vellore - the fort's granite walls and bastions ringed by their moat. */
function VelloreFort() {
  return (
    <g {...strokeProps}>
      {/* the moat */}
      <path d="M8 70 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity={0.7} />
      {/* the curtain wall */}
      <path d="M40 60 V38 H160 V60" />
      <path d="M40 38 V33 H48 V38 M60 38 V33 H68 V38 M80 38 V33 H88 V38 M112 38 V33 H120 V38 M132 38 V33 H140 V38 M152 38 V33 H160 V38" opacity={0.7} />
      {/* the round bastions at the corners */}
      <path d="M40 60 V30 a8 8 0 0 1 16 0 V60" />
      <path d="M144 60 V30 a8 8 0 0 1 16 0 V60" />
      {/* the temple gopuram rising inside */}
      <path d="M92 38 L95 22 H105 L108 38" opacity={0.85} />
    </g>
  );
}

/** Ranipet - the Palar's braided sand bed crossed by the Walajah anicut. */
function RanipetPalar() {
  return (
    <g {...strokeProps}>
      {/* the wide bed */}
      <path d="M0 48 C 40 46, 80 52, 120 50 S 170 46, 200 48" opacity={0.6} />
      <path d="M0 74 C 40 76, 80 70, 120 72 S 170 76, 200 74" opacity={0.6} />
      {/* braided threads of flow inside it */}
      <path d="M0 60 C 30 56, 50 66, 80 62 S 130 56, 200 62" opacity={0.45} />
      <path d="M20 66 C 50 70, 70 58, 100 64 S 150 70, 200 66" opacity={0.3} />
      {/* the anicut: a low weir across the bed */}
      <path d="M84 50 V72 H116 V50" />
      <path d="M84 56 H116 M84 62 H116 M84 68 H116" opacity={0.5} />
    </g>
  );
}

/** Dindigul - the rock fort under the Palani hills, a tank at its foot. */
function DindigulRockfort() {
  return (
    <g {...strokeProps}>
      {/* the hills */}
      <path d="M0 40 L30 20 L56 34 L86 14 L112 32" opacity={0.5} />
      {/* the rock with the fort wall */}
      <path d="M104 66 C 108 46, 122 32, 146 30 C 170 32, 184 46, 188 66" />
      <path d="M118 42 H176" opacity={0.7} />
      <path d="M122 42 V37 H128 V42 M140 42 V37 H148 V42 M160 42 V37 H168 V42" opacity={0.7} />
      {/* the tank */}
      <path d="M8 72 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" opacity={0.7} />
      <path d="M4 66 H104" opacity={0.35} />
    </g>
  );
}

/** Tiruvallur - a reservoir bund with its sluice tower, and Pulicat's flamingo. */
function TiruvallurReservoir() {
  return (
    <g {...strokeProps}>
      {/* the bund */}
      <path d="M0 66 L20 48 H180 L200 66" />
      <path d="M20 48 H180" opacity={0.5} />
      {/* the sluice tower */}
      <path d="M62 48 V30 H76 V48" />
      <path d="M60 30 H78 M66 36 H72" opacity={0.6} />
      {/* the water behind */}
      <path d="M90 40 q7 -3 14 0 t14 0 t14 0 t14 0 t14 0" opacity={0.5} />
      {/* the flamingo, in the lagoon in front: body, S-neck, beak, legs */}
      <path d="M118 62 C 122 54, 138 54, 142 60 C 138 68, 124 68, 118 62 Z" />
      <path d="M140 58 C 150 52, 150 42, 144 38 C 140 35, 136 38, 137 42" />
      <path d="M137 42 l-5 3" opacity={0.85} />
      <path d="M126 67 V76 M132 67 V76" opacity={0.7} />
      <path d="M0 76 H200" opacity={0.3} />
    </g>
  );
}

/** Krishnagiri - the gated KRP dam on the Thenpennai, beside a mango tree of the orchard country. */
function KrishnagiriDamMango() {
  return (
    <g {...strokeProps}>
      {/* the mango tree */}
      <path d="M34 66 V46" />
      <path d="M14 44 C 8 30, 22 18, 34 22 C 46 14, 62 26, 56 40 C 58 48, 44 50, 34 46 C 24 50, 12 50, 14 44 Z" />
      {/* the mangoes */}
      <path d="M22 50 c-3 3 -2 8 1 8 c3 0 3 -5 -1 -8 Z M46 50 c-3 3 -2 8 1 8 c3 0 3 -5 -1 -8 Z" opacity={0.85} />
      {/* the dam: crest, piers and gates */}
      <path d="M78 66 V38 H192 V66" />
      <path d="M74 38 H196" opacity={0.6} />
      <path d="M97 38 V66 M116 38 V66 M135 38 V66 M154 38 V66 M173 38 V66" opacity={0.7} />
      <path
        d="M82 66 V52 q5.5 -6 11 0 V66 M101 66 V52 q5.5 -6 11 0 V66 M120 66 V52 q5.5 -6 11 0 V66 M139 66 V52 q5.5 -6 11 0 V66 M158 66 V52 q5.5 -6 11 0 V66 M177 66 V52 q5.5 -6 11 0 V66"
        opacity={0.5}
      />
      {/* the river below */}
      <path d="M64 74 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" opacity={0.6} />
      <path d="M0 66 H78" opacity={0.35} />
    </g>
  );
}

/** Satara - a flat-topped Sahyadri fort hill above the Krishna. */
function SataraFortHill() {
  return (
    <g {...strokeProps}>
      {/* the hill: basalt terraces to a flat top */}
      <path d="M30 66 L56 40 H144 L170 66" />
      <path d="M46 50 H154 M40 56 H160" opacity={0.4} />
      {/* the fort wall on the crest */}
      <path d="M62 40 V35 H70 V40 M84 40 V35 H92 V40 M108 40 V35 H116 V40 M130 40 V35 H138 V40" opacity={0.7} />
      {/* the Krishna below */}
      <path d="M0 74 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity={0.7} />
    </g>
  );
}

/** Ahilyanagar - watershed work: contour bunds down a slope to a percolation tank. */
function AhilyanagarWatershed() {
  return (
    <g {...strokeProps}>
      {/* the slope */}
      <path d="M0 64 C 40 60, 80 44, 120 30 S 170 18, 200 14" opacity={0.85} />
      {/* contour bunds across it */}
      <path d="M150 26 q8 -6 16 0 M120 36 q8 -6 16 0 M92 46 q8 -6 16 0 M64 54 q8 -6 16 0" opacity={0.7} />
      <path d="M36 60 q8 -6 16 0" opacity={0.7} />
      {/* the check dam and tank at the foot */}
      <path d="M8 62 V72 H44 V62" />
      <path d="M14 66 q6 -3 12 0 t12 0" opacity={0.7} />
      <path d="M0 76 H200" opacity={0.3} />
    </g>
  );
}

/** Kolhapur - the Mahalakshmi shikhara over Rankala's ghat steps. */
function KolhapurRankala() {
  return (
    <g {...strokeProps}>
      {/* the shikhara: a stepped tower */}
      <path d="M78 52 H122 V46 H78 Z" />
      <path d="M84 46 L88 22 H112 L116 46" />
      <path d="M90 38 H110 M92 30 H108" opacity={0.6} />
      <path d="M94 22 L100 12 L106 22" />
      {/* the ghat steps to the lake */}
      <path d="M40 52 H160 M46 58 H154 M52 64 H148" opacity={0.6} />
      {/* Rankala */}
      <path d="M0 74 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" opacity={0.7} />
    </g>
  );
}

/** Kolar - a Kolar Gold Fields headframe above a chain of tanks, each
 *  bund spilling into the next. */
function KolarHeadframeTanks() {
  return (
    <g {...strokeProps}>
      {/* the headframe: legs, braces and the winding sheave */}
      <path d="M140 66 L152 18 L164 66" />
      <path d="M152 18 L176 66" opacity={0.7} />
      <path d="M144 50 H160 M147 38 H157 M149 28 H155" opacity={0.6} />
      <circle cx="152" cy="14" r="5" />
      <path d="M152 14 L182 40" opacity={0.5} />
      {/* the winding house */}
      <path d="M176 66 V48 H194 V66" opacity={0.8} />
      {/* the tank chain: three bunds stepping down, water behind each */}
      <path d="M4 44 q14 -6 28 0 M40 54 q16 -6 32 0 M82 64 q18 -6 36 0" />
      <path d="M8 48 q10 -3 20 0 M46 58 q10 -3 20 0 M90 68 q10 -3 20 0" opacity={0.6} />
      <path d="M32 44 L40 54 M72 54 L82 64" opacity={0.5} />
      <path d="M0 76 H200" opacity={0.3} />
    </g>
  );
}

/** Canals, tanks and a field bund: the mark every district shared before
 *  the per-district art, kept as the fallback for a district not yet drawn. */
function GenericTankCountry() {
  return (
    <g {...strokeProps}>
      <path d="M0 58 C 30 46, 55 70, 85 58 S 135 46, 165 58 S 190 66, 200 60" />
      <path d="M0 68 C 40 58, 65 78, 105 68 S 165 58, 200 70" strokeOpacity={0.55} />
      <path d="M22 42 V 24 H 62 V 42" strokeOpacity={0.85} />
      <path d="M112 38 V 20 H 152 V 38" strokeOpacity={0.85} />
      <path d="M30 33 h24 M120 29 h24" strokeOpacity={0.35} />
      <path d="M0 78 H 200" strokeOpacity={0.25} />
    </g>
  );
}

const DISTRICT_MARKS: Record<string, () => React.JSX.Element> = {
  "tn-thanjavur": ThanjavurDelta,
  "tn-tiruchirappalli": TiruchirappalliRockfort,
  "tn-salem": SalemMettur,
  "tn-tirupathur": TirupathurPalar,
  "tn-erode": ErodeBhavanisagar,
  "tn-namakkal": NamakkalRock,
  "tn-karur": KarurConfluence,
  "tn-tiruppur": TiruppurNoyyal,
  "tn-vellore": VelloreFort,
  "tn-ranipet": RanipetPalar,
  "tn-dindigul": DindigulRockfort,
  "tn-tiruvallur": TiruvallurReservoir,
  "tn-krishnagiri": KrishnagiriDamMango,
  "mh-satara": SataraFortHill,
  "mh-ahilyanagar": AhilyanagarWatershed,
  "mh-kolhapur": KolhapurRankala,
  "ka-kolar": KolarHeadframeTanks,
};

/** True when the district has its own drawn mark (used by tests and the
 *  drift check that every registered district is drawn). */
export function hasDistrictMark(scopeId: string): boolean {
  return scopeId in DISTRICT_MARKS;
}

export function DistrictMark({ scopeId, className }: { scopeId?: string; className?: string }) {
  const Art = (scopeId && DISTRICT_MARKS[scopeId]) || GenericTankCountry;
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
