// One-click "Download as PDF" for the Basin Atlas.
//
// Pipeline: capture the live Leaflet map container to a PNG (html-to-image -
// the OSM tile server sends Access-Control-Allow-Origin:*, and the atlas tile
// layer loads with crossOrigin so the capture fetch hits a CORS-clean cache),
// then compose a text-native PDF with @react-pdf/renderer from the same data
// objects the on-screen panels render. Both libraries are heavy and load only
// here, behind dynamic import, when the button is actually clicked.
//
// Fonts: the PDF uses the built-in Helvetica family (no font files shipped).
// Helvetica is WinAnsi-encoded, so every data string is passed through
// toWinAnsi() first: known typographic characters are mapped to close ASCII
// equivalents and anything else outside the encoding is dropped rather than
// crashing the render. The basin JSON is ASCII + curly quotes today; this is
// the guard for tomorrow's data edits.

import type { BasinManifest, BasinRiver } from "@/lib/basins";
import type { ReviewedMprSeries } from "@/lib/basins/reviewed-mpr";
import type {
  AccountabilityData,
  DepData,
  GapUnit,
  LegendItem,
  PrsData,
} from "@/components/basin/basin-atlas";

// Characters WinAnsi (CP1252) can encode: ASCII + Latin-1 + the 0x80-0x9F
// typographic extras (curly quotes, dashes, ellipsis, bullet, euro...).
const NOT_WIN_ANSI =
  /[^\t\n\r\x20-\x7e\u00a0-\u00ff\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/g;

const REPLACEMENTS: [RegExp, string][] = [
  [/≈/g, "~"], // almost-equal (the CETP legend note)
  [/[→⇒➜]/g, "->"],
  [/←/g, "<-"],
  [/[↑↗▸▶▾▼⌘●○⬆]/g, ""], // decorative arrows/glyphs
  [/₹/g, "Rs "],
  [/[✕✖❌]/g, "x"],
  [/[′‵]/g, "'"],
  [/″/g, '"'],
  [/[\u200b\u200c\u200d\ufeff]/g, ""], // zero-width characters
  [/⚠️?/g, "(!)"], // warning sign used by data caveats
];

export function toWinAnsi(input: string): string {
  let out = input;
  for (const [re, sub] of REPLACEMENTS) out = out.replace(re, sub);
  return out.replace(NOT_WIN_ANSI, "");
}

/** Recursively map every string in a plain-data value through toWinAnsi. */
export function sanitizeForPdf<T>(value: T): T {
  if (typeof value === "string") return toWinAnsi(value) as T;
  if (Array.isArray(value)) return value.map(sanitizeForPdf) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeForPdf(v)]),
    ) as T;
  }
  return value;
}

/** Leaflet chrome that must not appear in the exported image. The overlay
 *  buttons/legend live OUTSIDE the .leaflet-container, so they are already
 *  excluded by capturing the container itself; the attribution control stays
 *  in deliberately (OSM licence). */
function captureFilter(node: Node): boolean {
  if (!(node instanceof Element)) return true;
  const cls = node.classList;
  return !(
    cls.contains("leaflet-control-zoom") ||
    cls.contains("leaflet-tooltip") ||
    cls.contains("leaflet-popup") ||
    cls.contains("leaflet-tooltip-pane") ||
    cls.contains("leaflet-popup-pane")
  );
}

async function captureMapPng(mapEl: HTMLElement): Promise<string> {
  const { toPng } = await import("html-to-image");
  const opts = {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    filter: captureFilter,
  };
  // Safari sometimes returns a blank/partial image on the first render of a
  // cloned SVG tree (html-to-image #361); a warm-up pass fixes it.
  const isSafari = typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    await toPng(mapEl, opts);
    await toPng(mapEl, opts);
  }
  return toPng(mapEl, opts);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface ExportBasinPdfArgs {
  /** The .leaflet-container element to capture. */
  mapEl: HTMLElement;
  manifest: BasinManifest;
  /** Label + feature count for each layer visible at export. */
  inventoryRows: { label: string; count: number }[];
  scopeLabel: string;
  legendItems: LegendItem[];
  legendNotes: string[];
  selectedRiver: BasinRiver | null;
  prs: PrsData | null;
  acc: AccountabilityData | null;
  reviewedMpr: ReviewedMprSeries | null;
  dep: DepData | null;
  gapUnits: GapUnit[];
  gapNote: string | null;
  includeGaps: boolean;
  shareUrl: string;
}

export async function exportBasinAtlasPdf(args: ExportBasinPdfArgs): Promise<void> {
  const mapAspect = args.mapEl.clientWidth > 0 ? args.mapEl.clientHeight / args.mapEl.clientWidth : 0.7;
  const mapPng = await captureMapPng(args.mapEl);

  const [{ pdf }, { BasinReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/basin/basin-pdf-report"),
  ]);

  const generatedAt = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  // Sanitize the data payload once, at this single choke point, so the PDF
  // components never have to think about encodings. The captured PNG and the
  // URL-encoded share link are ASCII already and skip the (expensive) walk.
  const data = sanitizeForPdf({
    manifest: args.manifest,
    inventoryRows: args.inventoryRows,
    scopeLabel: args.scopeLabel,
    legendItems: args.legendItems,
    legendNotes: args.legendNotes,
    selectedRiver: args.selectedRiver,
    prs: args.prs,
    acc: args.acc,
    reviewedMpr: args.reviewedMpr,
    dep: args.dep,
    gapUnits: args.gapUnits,
    gapNote: args.gapNote,
    generatedAt,
  });

  const blob = await pdf(
    <BasinReportDocument
      {...data}
      includeGaps={args.includeGaps}
      mapPng={mapPng}
      mapAspect={mapAspect}
      shareUrl={args.shareUrl}
      origin={window.location.origin}
    />,
  ).toBlob();

  const day = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `neer-vazhvu-${args.manifest.basinId}-atlas-${day}.pdf`);
}
