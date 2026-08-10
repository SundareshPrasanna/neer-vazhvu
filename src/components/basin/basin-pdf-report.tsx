// The Basin Atlas PDF report - a text-native @react-pdf/renderer document.
//
// Page 1 mirrors the map as configured at export (captured PNG + the same
// legend the on-screen MapLegend derives), then the PRS story and the DEP
// treatment-gap snapshot re-render as REAL text - searchable, quotable and
// citable - never screenshots of the panels. Content comes from the same
// loaded data objects the panels render (prs.json / accountability.json /
// gaps.json / mpr-reviewed.json), so the PDF can never say something the
// atlas doesn't.
//
// This module is only ever loaded through the dynamic import in
// lib/basins/export-pdf.tsx, keeping @react-pdf/renderer out of the main
// bundle. Fonts: the built-in Helvetica family - every string is passed
// through the WinAnsi sanitizer in export-pdf before it reaches this
// document, so no font files ship with the app.

import type { ReactNode } from "react";
import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Svg,
  Polygon,
  Text,
  View,
} from "@react-pdf/renderer";
import type { BasinManifest, BasinRiver } from "@/lib/basins";
import {
  reviewedMprConceptLabel,
  reviewedMprValueLabel,
  type ReviewedMprSeries,
} from "@/lib/basins/reviewed-mpr";
import {
  ACC_KIND_LABEL,
  ACC_VERDICT_LABEL,
  DEP_STATUS_LABEL,
  depThemeTitle,
} from "@/lib/basins/panel-labels";
// Type-only: erased at compile time, so this module never pulls the Leaflet
// component tree in at runtime (which also keeps it renderable in Node tests).
import type {
  AccountabilityData,
  AccRegion,
  DepData,
  DepTheme,
  GapUnit,
  LegendItem,
  PrsData,
  PrsTab,
  PrsUnit,
} from "@/components/basin/basin-atlas";

export interface BasinReportProps {
  manifest: BasinManifest;
  /** One row per layer VISIBLE at export (label + feature count) - the PDF is
   *  state-faithful, so the data table never lists layers that aren't shown. */
  inventoryRows: { label: string; count: number }[];
  generatedAt: string;
  scopeLabel: string;
  mapPng: string;
  /** Captured map height / width. */
  mapAspect: number;
  legendItems: LegendItem[];
  legendNotes: string[];
  selectedRiver: BasinRiver | null;
  prs: PrsData | null;
  acc: AccountabilityData | null;
  reviewedMpr: ReviewedMprSeries | null;
  dep: DepData | null;
  /** v1 gaps.json units (empty for v2/DEP basins). */
  gapUnits: GapUnit[];
  gapNote: string | null;
  includeGaps: boolean;
  shareUrl: string;
  origin: string;
}

const C = {
  text: "#111827",
  muted: "#64748b",
  faint: "#94a3b8",
  border: "#e2e8f0",
  soft: "#f8fafc",
  rose: "#be123c",
  roseBg: "#fff1f2",
  roseBorder: "#fecdd3",
  amber: "#b45309",
  amberBg: "#fffbeb",
  amberBorder: "#fde68a",
  emerald: "#047857",
  emeraldBg: "#ecfdf5",
  sky: "#0369a1",
  skyBg: "#f0f9ff",
  blue: "#1d4ed8",
  slateChipBg: "#f1f5f9",
};

const VERDICT_COLOR: Record<string, { fg: string; bg: string }> = {
  tracked: { fg: C.emerald, bg: C.emeraldBg },
  "in-plan-not-reported": { fg: C.amber, bg: C.amberBg },
  "reported-not-in-plan": { fg: C.sky, bg: C.skyBg },
  silent: { fg: C.rose, bg: C.roseBg },
};
const DEP_STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  covered: { fg: C.emerald, bg: C.emeraldBg },
  "district-level": { fg: C.sky, bg: C.skyBg },
  "not-covered": { fg: C.rose, bg: C.roseBg },
};
const TONE_COLOR: Record<string, { fg: string; bg: string }> = {
  bad: { fg: C.rose, bg: C.roseBg },
  warn: { fg: C.amber, bg: C.amberBg },
  neutral: { fg: C.muted, bg: C.slateChipBg },
  good: { fg: C.emerald, bg: C.emeraldBg },
};

const s = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingHorizontal: 36,
    paddingBottom: 52,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.text,
    // NO lineHeight here (and none on the footer styles below): fixed
    // per-page elements (the page number's render callback) re-resolve
    // inherited styles on every page, and react-pdf compounds an inherited
    // lineHeight exponentially until pdfkit throws "unsupported number".
    // Every flowing text style carries its own lineHeight instead.
  },
  // Header / title block
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold", lineHeight: 1.15 },
  brand: { fontSize: 9, color: C.muted, textAlign: "right", lineHeight: 1.3 },
  collabRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  collabLabel: { fontSize: 8.5, color: C.muted, marginRight: 6, lineHeight: 1.2 },
  collabLogo: { height: 22, objectFit: "contain" },
  metaLine: { fontSize: 8.5, color: C.muted, marginTop: 8, lineHeight: 1.3 },
  // Sections
  section: { marginTop: 9 },
  h2: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: C.muted,
    marginBottom: 4,
    lineHeight: 1.2,
  },
  h2Rose: { color: C.rose },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2, lineHeight: 1.2 },
  body: { fontSize: 9, color: C.text, lineHeight: 1.3 },
  small: { fontSize: 8, color: C.muted, lineHeight: 1.3 },
  tiny: { fontSize: 7, color: C.faint, lineHeight: 1.25 },
  // Map
  mapImage: { borderWidth: 1, borderColor: C.border, borderRadius: 3 },
  // Legend
  legendWrap: { flexDirection: "row", flexWrap: "wrap", marginTop: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", width: "33.33%", paddingRight: 8, marginBottom: 3 },
  legendLabel: { fontSize: 7.5, color: C.text, marginLeft: 4, flex: 1, lineHeight: 1.2 },
  // Key-value rows
  kvBox: { borderWidth: 1, borderColor: C.border, borderRadius: 4, marginTop: 4 },
  kvRow: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  kvRowFirst: { borderTopWidth: 0 },
  kvLabel: { width: 110, fontSize: 8, color: C.muted, lineHeight: 1.25 },
  kvValue: { flex: 1, fontSize: 8.5, lineHeight: 1.25 },
  // Callouts
  callout: { borderWidth: 1, borderRadius: 4, padding: 5, marginTop: 4 },
  // Chips
  chip: { borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1.5, alignSelf: "flex-start" },
  chipText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1.1 },
  // Bars
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barYear: { width: 26, fontSize: 7.5, color: C.muted, lineHeight: 1.2 },
  barTrack: { flex: 1, height: 9, backgroundColor: "#f1f5f9", borderRadius: 2, flexDirection: "row", overflow: "hidden" },
  barValue: { width: 84, fontSize: 7.5, color: C.muted, textAlign: "right", paddingLeft: 4, lineHeight: 1.2 },
  // Bullets
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10, fontSize: 8.5, color: C.faint, lineHeight: 1.3 },
  bulletText: { flex: 1, fontSize: 8.5, lineHeight: 1.3 },
  // Footer
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.faint },
  footerLink: { fontSize: 7, color: C.blue, textDecoration: "none" },
  pageNum: { position: "absolute", right: 36, bottom: 8, fontSize: 7, color: C.faint },
  link: { color: C.blue, textDecoration: "none" },
});

function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function Bullet({ children, color = C.faint }: { children: ReactNode; color?: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={[s.bulletDot, { color }]}>{"•"}</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function KvRows({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return (
    <View style={s.kvBox}>
      {rows.map((r, i) => (
        <View key={i} style={[s.kvRow, ...(i === 0 ? [s.kvRowFirst] : [])]} wrap={false}>
          <Text style={s.kvLabel}>{r.label}</Text>
          <Text style={s.kvValue}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

function LegendSwatch({ sym, color }: { sym: string; color: string }) {
  const base = { width: 7, height: 7 };
  if (sym === "dot") return <View style={{ ...base, borderRadius: 3.5, backgroundColor: color }} />;
  if (sym === "ring") return <View style={{ ...base, borderRadius: 3.5, borderWidth: 1.4, borderColor: color }} />;
  if (sym === "line") return <View style={{ width: 10, height: 2, backgroundColor: color }} />;
  if (sym === "dash")
    return (
      <View style={{ width: 10, height: 2, flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ width: 4, height: 2, backgroundColor: color }} />
        <View style={{ width: 4, height: 2, backgroundColor: color }} />
      </View>
    );
  if (sym === "outline") return <View style={{ ...base, borderWidth: 1, borderColor: color }} />;
  if (sym === "tri" || sym === "tri-ring")
    return (
      <Svg width={8} height={8} viewBox="0 0 12 12">
        <Polygon
          points="6,1 11.5,11 0.5,11"
          fill={sym === "tri" ? color : "none"}
          stroke={color}
          strokeWidth={sym === "tri" ? 0 : 1.8}
        />
      </Svg>
    );
  return <View style={{ ...base, borderRadius: 1, backgroundColor: color }} />;
}

/** One year's generated-vs-treated bar - the PDF twin of GenTreatedBar. */
function GenBar({ year, gen, treated, max, unit }: { year: number; gen?: number; treated?: number; max: number; unit: string }) {
  const pct = (v: number) => `${Math.max(0, (v / max) * 100)}%` as const;
  let segments: ReactNode = null;
  let value = "n/r";
  if (gen != null && treated != null) {
    const tr = Math.min(treated, gen);
    segments = (
      <>
        <View style={{ width: pct(tr), backgroundColor: "#3b82f6" }} />
        <View style={{ width: pct(gen - tr), backgroundColor: "#b91c1c" }} />
      </>
    );
    value = `${treated} / ${gen} ${unit}`;
  } else if (gen != null) {
    segments = <View style={{ width: pct(gen), backgroundColor: "#94a3b8" }} />;
    value = `${gen} ${unit} gen`;
  } else if (treated != null) {
    segments = <View style={{ width: pct(treated), backgroundColor: "#3b82f6" }} />;
    value = `${treated} ${unit}`;
  }
  return (
    <View style={s.barRow} wrap={false}>
      <Text style={s.barYear}>{year}</Text>
      <View style={s.barTrack}>{segments}</View>
      <Text style={s.barValue}>{value}</Text>
    </View>
  );
}

function Footer({ shareUrl }: { shareUrl: string }) {
  return (
    <>
      <View fixed style={s.footer}>
        <Link src={shareUrl} style={s.footerLink}>
          View the live interactive map (link)
        </Link>
        <Text style={s.footerText}>Neer Vazhvu · neervazhvu.org</Text>
      </View>
      <Text fixed style={s.pageNum} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </>
  );
}

// ── Page 1: the map as configured ────────────────────────────────────────────

function MapPage(p: BasinReportProps) {
  const contentW = 595.28 - 72; // A4 minus margins
  const maxH = 380;
  let w = contentW;
  let h = w * p.mapAspect;
  if (h > maxH) {
    h = maxH;
    w = h / p.mapAspect;
  }
  return (
    <Page size="A4" style={s.page}>
      <View style={s.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{p.manifest.displayName} Atlas</Text>
          {p.manifest.collaboration && (
            <View style={s.collabRow}>
              <Text style={s.collabLabel}>
                {p.manifest.collaboration.label} {p.manifest.collaboration.name}
              </Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
              <Image src={`${p.origin}${p.manifest.collaboration.logo}`} style={s.collabLogo} />
            </View>
          )}
        </View>
        <Text style={s.brand}>Neer Vazhvu{"\n"}neervazhvu.org</Text>
      </View>
      <Text style={s.metaLine}>
        Generated {p.generatedAt} · Scope: {p.scopeLabel} · Map and layer selection exactly as configured in the atlas at export.
      </Text>

      <View style={{ marginTop: 10, alignItems: "center" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
        <Image src={p.mapPng} style={[s.mapImage, { width: w, height: h }]} />
      </View>
      <Text style={[s.tiny, { marginTop: 3 }]}>
        Basemap (c) OpenStreetMap contributors. Live version of this exact view: {p.shareUrl}
      </Text>

      {p.legendItems.length > 0 && (
        <View style={s.section}>
          <Text style={s.h2}>Legend - layers on this map</Text>
          <View style={s.legendWrap}>
            {p.legendItems.map((it, i) => (
              <View key={i} style={s.legendItem} wrap={false}>
                <LegendSwatch sym={it.sym} color={it.color} />
                <Text style={s.legendLabel}>{it.label}</Text>
              </View>
            ))}
          </View>
          {p.legendNotes.map((n, i) => (
            <Text key={i} style={[s.small, { marginTop: 2 }]}>
              {n}
            </Text>
          ))}
        </View>
      )}

      {p.selectedRiver && (
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Selected river: {p.selectedRiver.displayName}</Text>
          {p.selectedRiver.attributes && (
            <KvRows
              rows={[
                { label: "Origin", value: p.selectedRiver.attributes.origin ?? "" },
                { label: "Length", value: p.selectedRiver.attributes.length ?? "" },
                { label: "Tributaries", value: p.selectedRiver.attributes.tributaries ?? "" },
                { label: "Flows into", value: p.selectedRiver.attributes.flowsInto ?? "" },
                { label: "Polluted river stretch", value: p.selectedRiver.attributes.pollutedStretch ?? "" },
                { label: "Restoration initiatives", value: p.selectedRiver.attributes.restorationInitiatives ?? "" },
              ].filter((r) => r.value)}
            />
          )}
          {p.selectedRiver.narrative && <Text style={[s.small, { marginTop: 3 }]}>{p.selectedRiver.narrative}</Text>}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.h2}>About this basin</Text>
        <Text style={s.small}>{p.manifest.blurb}</Text>
        {p.manifest.areaKm2 && (
          <Text style={[s.tiny, { marginTop: 2 }]}>
            Basin area ~{p.manifest.areaKm2.toLocaleString("en-IN")} km squared.{p.manifest.areaNote ? ` ${p.manifest.areaNote}` : ""}
          </Text>
        )}
      </View>

      <Footer shareUrl={p.shareUrl} />
    </Page>
  );
}

// ── PRS pages ────────────────────────────────────────────────────────────────

function PrsUnitBlock({ unit, tab }: { unit: PrsUnit; tab: PrsTab }) {
  const unitLabel = tab.unitLabel ?? "MLD";
  const treatedVerb = tab.treatedVerb ?? "treated";
  const gapWord = treatedVerb === "processed" ? "unprocessed" : "untreated";
  const genBy = new Map(unit.generation.map((pt) => [pt.year, pt.value]));
  const trBy = new Map(unit.treated.map((pt) => [pt.year, pt.value]));
  const years = Array.from(new Set([...genBy.keys(), ...trBy.keys()])).sort((a, b) => a - b);
  const maxV = Math.max(1, ...unit.generation.map((pt) => pt.value), ...unit.treated.map((pt) => pt.value));
  return (
    // wrap: a unit block (BBMP: five years of bars + a long infrastructure
    // list) can exceed a page; wrap={false} here would clip it.
    <View style={[s.callout, { borderColor: C.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
        <Text style={[s.h3, { flex: 1, fontSize: 9.5, marginBottom: 0 }]}>{unit.name}</Text>
        {unit.level && <Chip label={`Reported at: ${unit.level}`} fg={C.muted} bg={C.slateChipBg} />}
      </View>
      {unit.sourceTier === "other" && (
        <Text style={[s.tiny, { marginBottom: 2 }]}>
          {unit.mprNote ?? `Not itemised in any MPR edition we hold - figures below are from other public documents.`}
        </Text>
      )}
      {unit.caveat && <Text style={[s.tiny, { color: C.amber, marginBottom: 2 }]}>{unit.caveat}</Text>}
      {years.length > 0 ? (
        <>
          <Text style={[s.tiny, { marginBottom: 2 }]}>
            Generated vs {treatedVerb} ({unitLabel}/year) - blue = {treatedVerb}, red = {gapWord} gap, grey = treatment not reported
          </Text>
          {years.map((y) => (
            <GenBar key={y} year={y} gen={genBy.get(y)} treated={trBy.get(y)} max={maxV} unit={unitLabel} />
          ))}
        </>
      ) : (
        <Text style={s.tiny}>{unit.generationNote ?? "Generation not separately reported."}</Text>
      )}
      {years.length > 0 && unit.generationNote && <Text style={s.tiny}>{unit.generationNote}</Text>}
      {typeof unit.gapValue === "number" && (
        <Text style={[s.small, { color: C.rose, marginTop: 2 }]}>
          {gapWord.charAt(0).toUpperCase() + gapWord.slice(1)} gap {unit.gapValue} {unitLabel}
          {unit.gapNote ? ` - ${unit.gapNote}` : ""}
        </Text>
      )}
      {unit.capacity && <Text style={[s.small, { marginTop: 2 }]}>Capacity: {unit.capacity}</Text>}
      {unit.infrastructure?.map((it, i) => (
        <Bullet key={i} color={it.tone === "good" ? C.emerald : it.tone === "bad" ? C.rose : C.faint}>
          {it.label}: {it.status}
        </Bullet>
      ))}
      {unit.otherStreams?.map((st, i) => (
        <Text key={i} style={s.small}>
          {st.label}: {st.value}
        </Text>
      ))}
      {unit.dashboard && <Text style={s.tiny}>Public dashboard: {unit.dashboard}</Text>}
      {unit.sourceNote && <Text style={s.tiny}>Source: {unit.sourceNote}</Text>}
    </View>
  );
}

function PrsTabDetail({ tab }: { tab: PrsTab }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={s.h3}>{tab.label}</Text>
      {tab.intro && <Text style={[s.small, { marginBottom: 2 }]}>{tab.intro}</Text>}
      {tab.units?.map((u) => <PrsUnitBlock key={u.key} unit={u} tab={tab} />)}
      {tab.categories?.map((c) => (
        <View key={c.key} style={[s.callout, { borderColor: C.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
            <Text style={[s.h3, { flex: 1, fontSize: 9.5, marginBottom: 0 }]}>{c.label}</Text>
            {c.level && <Chip label={`Reported at: ${c.level}`} fg={C.muted} bg={C.slateChipBg} />}
          </View>
          {c.noData ? (
            <Text style={s.small}>No known public data yet for {c.label} along this stretch.</Text>
          ) : (
            <>
              {c.body && <Text style={[s.small, { color: C.text, marginBottom: 2 }]}>{c.body}</Text>}
              {c.points?.map((pt, i) => (
                <Bullet key={i} color={C.rose}>
                  {pt}
                </Bullet>
              ))}
              {c.link && (
                <Text wrap={false} style={s.tiny}>
                  {c.link.label}: <Link src={c.link.url} style={s.link}>{c.link.url}</Link>
                </Text>
              )}
            </>
          )}
        </View>
      ))}
      {tab.source && <Text style={[s.tiny, { marginTop: 2 }]}>Source: {tab.source}</Text>}
    </View>
  );
}

function AccRegionBlock({ region, acc }: { region: AccRegion; acc: AccountabilityData }) {
  return (
    <View style={[s.callout, { borderColor: C.border }]}>
      <Text style={[s.h3, { fontSize: 10 }]}>{region.name}</Text>
      {region.inBasinNote && <Text style={[s.tiny, { marginBottom: 2 }]}>{region.inBasinNote}</Text>}
      {region.silentNote ? (
        <View>
          <Chip label={ACC_VERDICT_LABEL.silent} fg={VERDICT_COLOR.silent.fg} bg={VERDICT_COLOR.silent.bg} />
          <Text style={[s.small, { marginTop: 2 }]}>{region.silentNote}</Text>
        </View>
      ) : (
        region.categories.map((c) => (
          <View key={c.key} style={{ marginTop: 4, paddingTop: 3, borderTopWidth: 1, borderTopColor: "#f1f5f9" }} wrap={false}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[s.body, { fontFamily: "Helvetica-Bold", flex: 1 }]}>{c.label}</Text>
              <Chip
                label={ACC_VERDICT_LABEL[c.verdict]}
                fg={VERDICT_COLOR[c.verdict]?.fg ?? C.muted}
                bg={VERDICT_COLOR[c.verdict]?.bg ?? C.slateChipBg}
              />
            </View>
            <Text style={[s.small, { marginTop: 1.5 }]}>
              Action Plan (2019): {c.actionPlan.summary}
              {c.actionPlan.cite ? ` [${c.actionPlan.cite}]` : ""}
            </Text>
            <Text style={s.small}>
              MPR status (as of {c.mpr.asOf}): {c.mpr.summary}
            </Text>
            {c.gaps?.map((g, i) => (
              <Bullet key={i} color={C.rose}>
                Gap identified: {g}
              </Bullet>
            ))}
            {c.legalRef &&
              acc.legalLibrary?.[c.legalRef]?.map((l, i) => (
                <Text wrap={false} key={i} style={s.tiny}>
                  Legal requirement: <Link src={l.url} style={s.link}>{l.label}</Link>
                </Text>
              ))}
            {c.media?.map((m, i) => (
              <Text wrap={false} key={i} style={s.tiny}>
                Media: <Link src={m.url} style={s.link}>{m.label}</Link>
              </Text>
            ))}
          </View>
        ))
      )}
      {region.grievance && (
        <Text wrap={false} style={[s.tiny, { marginTop: 3 }]}>
          {region.grievance.label}: <Link src={region.grievance.url} style={s.link}>{region.grievance.url}</Link>
        </Text>
      )}
    </View>
  );
}

function PrsPages(p: BasinReportProps) {
  const prs = p.prs!;
  const maxKm = Math.max(prs.comparison.y2020.length_km, prs.comparison.y2025.length_km) || 1;
  const rows = [
    { year: "2020", ...prs.comparison.y2020, accent: "#fb7185" },
    { year: "2025", ...prs.comparison.y2025, accent: "#b91c1c" },
  ];
  const stretchTabs = prs.tabs.filter((t) => t.scope === "stretch");
  const latestMpr = p.reviewedMpr?.editions.at(-1);
  return (
    <Page size="A4" style={s.page}>
      <Text style={[s.h2, s.h2Rose]}>Polluted River Stretch (PRS) - CPCB / NGT</Text>
      <Text style={s.title}>{prs.river}</Text>
      <Text style={[s.small, { marginBottom: 6 }]}>{prs.stretchName}</Text>

      {/* Current status: 2020 vs 2025 */}
      <Text style={s.h2}>Current status</Text>
      {rows.map((r) => (
        <View key={r.year} style={s.barRow} wrap={false}>
          <Text style={s.barYear}>{r.year}</Text>
          <View style={s.barTrack}>
            <View style={{ width: `${(r.length_km / maxKm) * 100}%`, backgroundColor: r.accent }} />
          </View>
          <Text style={s.barValue}>
            {r.length_km} km · P{r.priority}
          </Text>
        </View>
      ))}
      {prs.statusLine && (
        <View style={[s.callout, { borderColor: C.roseBorder, backgroundColor: C.roseBg }]}>
          <Text style={[s.body, { fontFamily: "Helvetica-Bold", color: "#881337" }]}>{prs.statusLine}</Text>
        </View>
      )}
      {!prs.statusFacts && prs.conclusion && (
        <View style={[s.callout, { borderColor: C.roseBorder, backgroundColor: C.roseBg }]}>
          <Text style={[s.body, { fontFamily: "Helvetica-Bold", color: "#881337" }]}>{prs.conclusion}</Text>
        </View>
      )}
      {prs.statusFacts && <KvRows rows={prs.statusFacts} />}

      {/* Governance & compliance */}
      {prs.governance && (
        <View style={s.section}>
          <Text style={s.h2}>Governance &amp; compliance</Text>
          <KvRows rows={prs.governance.rows} />
          {prs.governance.actionPlan && (
            <Text wrap={false} style={[s.tiny, { marginTop: 2 }]}>
              {prs.governance.actionPlan.label ?? "Action Plan"}:{" "}
              <Link src={prs.governance.actionPlan.url} style={s.link}>{prs.governance.actionPlan.url}</Link>
            </Text>
          )}
          {prs.governance.compliance?.map((c, i) => (
            <Text wrap={false} key={i} style={[s.small, { marginTop: 1.5 }]}>
              Compliance: {c.value}
              {c.link ? " - " : ""}
              {c.link && <Link src={c.link.url} style={s.link}>{c.link.label}</Link>}
              {c.note ? ` (${c.note})` : ""}
            </Text>
          ))}
          {prs.governance.note && <Text style={[s.tiny, { marginTop: 2 }]}>{prs.governance.note}</Text>}
        </View>
      )}

      {/* Stretch-level obligations: status list + full detail per theme */}
      {stretchTabs.length > 0 && (
        <View style={s.section}>
          <Text style={s.h2}>Stretch-level obligations (reported for the stretch as a whole)</Text>
          {stretchTabs.map((t) => (
            <View key={t.key} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }} wrap={false}>
              {t.summaryBadge && (
                <View style={{ width: 92, marginRight: 6 }}>
                  <Chip
                    label={t.summaryBadge}
                    fg={TONE_COLOR[t.summaryTone ?? "neutral"].fg}
                    bg={TONE_COLOR[t.summaryTone ?? "neutral"].bg}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.body, { fontFamily: "Helvetica-Bold" }]}>{t.label}</Text>
                {t.summaryLine && <Text style={s.tiny}>{t.summaryLine}</Text>}
              </View>
            </View>
          ))}
          {stretchTabs.map((t) => (
            <PrsTabDetail key={t.key} tab={t} />
          ))}
        </View>
      )}

      {/* Evidence of pollution */}
      {prs.evidence && (
        <View style={s.section}>
          <Text style={[s.h2, s.h2Rose]}>Evidence of pollution</Text>
          <Text style={[s.body, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{prs.evidence.headline}</Text>
          {prs.evidence.points.map((pt, i) => (
            <Bullet key={i}>{pt}</Bullet>
          ))}
          {prs.evidence.link && (
            <Text wrap={false} style={s.tiny}>
              {prs.evidence.link.label}: <Link src={prs.evidence.link.url} style={s.link}>{prs.evidence.link.url}</Link>
            </Text>
          )}
        </View>
      )}

      {/* Reviewed monthly progress (latest edition) */}
      {latestMpr && (
        <View style={s.section}>
          <Text style={s.h2}>Reviewed monthly progress - {latestMpr.source.title}</Text>
          <Text wrap={false} style={s.tiny}>
            Values published after platform review; page numbers cite the report.{" "}
            <Link src={latestMpr.source.url} style={s.link}>Source PDF</Link>
          </Text>
          {(() => {
            const groups = new Map<string, typeof latestMpr.records>();
            for (const r of latestMpr.records) {
              groups.set(r.subjectLabel, [...(groups.get(r.subjectLabel) ?? []), r]);
            }
            return [...groups.entries()].map(([subject, records]) => (
              <View key={subject} style={{ marginTop: 3 }} wrap={false}>
                <Text style={[s.small, { fontFamily: "Helvetica-Bold", color: C.text }]}>{subject}</Text>
                {records.map((r) => (
                  <Text key={r.claimId} style={s.small}>
                    {reviewedMprConceptLabel(r.concept)}: {reviewedMprValueLabel(r.value)} (p. {r.pageNumber})
                  </Text>
                ))}
              </View>
            ));
          })()}
        </View>
      )}

      {/* Accountability matrix */}
      {p.acc && (
        <View style={s.section}>
          <Text style={s.h2}>Accountability: plan vs progress reports</Text>
          <Text style={[s.body, { fontFamily: "Helvetica-Bold", marginBottom: 2 }]}>{p.acc.question}</Text>
          {p.acc.baseline.banner && (
            <View style={[s.callout, { borderColor: C.amberBorder, backgroundColor: C.amberBg, marginBottom: 3 }]}>
              <Text style={[s.small, { color: "#78350f" }]}>{p.acc.baseline.banner}</Text>
            </View>
          )}
          {(["ulb", "ia", "gp"] as const)
            .filter((k) => p.acc!.regions.some((r) => r.kind === k))
            .map((k) => (
              <View key={k} style={{ marginTop: 5 }}>
                <Text style={[s.h2, { color: C.text }]}>{ACC_KIND_LABEL[k]}</Text>
                {p.acc!.regions
                  .filter((r) => r.kind === k)
                  .map((r) => (
                    <AccRegionBlock key={r.key} region={r} acc={p.acc!} />
                  ))}
              </View>
            ))}
          <Text wrap={false} style={[s.tiny, { marginTop: 3 }]}>
            Baseline: {p.acc.baseline.primary.label}, {p.acc.baseline.primary.asOf}.{" "}
            <Link src={p.acc.baseline.actionPlan.url} style={s.link}>{p.acc.baseline.actionPlan.label}</Link>
            {p.acc.baseline.primary.note ? ` ${p.acc.baseline.primary.note}` : ""}
          </Text>
        </View>
      )}

      {/* Key terms, methodology, sources */}
      {prs.keyTerms && prs.keyTerms.length > 0 && (
        <View style={s.section}>
          <Text style={s.h2}>Key terms used in this report</Text>
          {prs.keyTerms.map((t) => (
            <Text key={t.term} style={[s.small, { marginBottom: 1.5 }]} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: C.text }}>{t.term}</Text> - {t.full}
              {t.note ? `. ${t.note}` : ""}
            </Text>
          ))}
        </View>
      )}
      <View style={s.section}>
        <Text style={s.h2}>Priority, methodology &amp; data coverage</Text>
        {[prs.reportingCaveat, prs.growthNote, prs.priorityNote, prs.bodCaveat, prs.mprOverview]
          .filter((x): x is string => !!x)
          .map((x, i) => (
            <Text key={i} style={[s.small, { marginBottom: 2 }]}>
              {x}
            </Text>
          ))}
        {prs.levelCoverage && (
          <Text style={[s.small, { marginBottom: 2 }]}>Reporting level: {prs.levelCoverage}</Text>
        )}
        {prs.citeSource && (
          <Text wrap={false} style={s.tiny}>
            {prs.citeSource.label ?? "Cite this data source"}:{" "}
            <Link src={prs.citeSource.url} style={s.link}>{prs.citeSource.url}</Link>
          </Text>
        )}
      </View>
      {prs.sources && prs.sources.length > 0 && (
        <View style={s.section}>
          <Text style={s.h2}>Sources</Text>
          {prs.sources.map((src, i) => (
            <Text key={i} style={[s.tiny, { marginBottom: 1 }]}>
              {src}
            </Text>
          ))}
        </View>
      )}
      {prs.grievance && (
        <Text wrap={false} style={[s.small, { marginTop: 6 }]}>
          {prs.grievance.label}: <Link src={prs.grievance.url} style={s.link}>{prs.grievance.url}</Link>
          {prs.grievance.urlNote ? ` (${prs.grievance.urlNote})` : ""}
        </Text>
      )}

      <Footer shareUrl={p.shareUrl} />
    </Page>
  );
}

// ── Treatment & waste gaps (DEP snapshot v2 / v1 units) ─────────────────────

function DepThemeRows({ themes }: { themes: DepTheme[] }) {
  return (
    <View>
      {themes.map((t, i) => (
        <View key={i} style={{ marginTop: 3, paddingTop: 2, borderTopWidth: i ? 1 : 0, borderTopColor: "#f1f5f9" }} wrap={false}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[s.body, { fontFamily: "Helvetica-Bold", flex: 1 }]}>{depThemeTitle(t)}</Text>
            <Chip
              label={DEP_STATUS_LABEL[t.status]}
              fg={DEP_STATUS_COLOR[t.status]?.fg ?? C.muted}
              bg={DEP_STATUS_COLOR[t.status]?.bg ?? C.slateChipBg}
            />
          </View>
          {t.summary && <Text style={s.small}>{t.summary}</Text>}
          {t.metrics?.map((m, j) => (
            <View key={j} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.small}>{m.label}</Text>
              <Text
                style={[
                  s.small,
                  {
                    textAlign: "right",
                    color: m.emphasis === "good" ? C.emerald : m.emphasis ? C.rose : C.text,
                    fontFamily: m.emphasis ? "Helvetica-Bold" : "Helvetica",
                  },
                ]}
              >
                {m.value}
              </Text>
            </View>
          ))}
          {t.openActions?.map((a, j) => (
            <Bullet key={j} color={C.amber}>
              Action item in the plan: {a}
            </Bullet>
          ))}
          {(t.pages?.length || t.ocrUncertain) && (
            <Text style={s.tiny}>
              {t.pages?.length ? `DEP p. ${t.pages.join(", ")}` : ""}
              {t.ocrUncertain ? `${t.pages?.length ? " - " : ""}read via OCR from a scanned plan; values approximate` : ""}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function ConflictList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={[s.callout, { borderColor: C.amberBorder, backgroundColor: C.amberBg }]}>
      <Text style={[s.tiny, { color: C.amber, fontFamily: "Helvetica-Bold", marginBottom: 1 }]}>{title}</Text>
      {items.map((c, i) => (
        <Bullet key={i} color={C.amber}>
          {c}
        </Bullet>
      ))}
    </View>
  );
}

function GapsPages(p: BasinReportProps) {
  const dep = p.dep;
  return (
    <Page size="A4" style={s.page}>
      <Text style={[s.h2, s.h2Rose]}>Treatment &amp; waste gaps</Text>
      <Text style={s.title}>{dep?.title ?? "District Environment Plan (DEP) 2022 Snapshot"}</Text>
      {dep?.note && <Text style={[s.small, { marginTop: 2 }]}>{dep.note}</Text>}
      {p.gapNote && !dep && <Text style={[s.small, { marginTop: 2 }]}>{p.gapNote}</Text>}

      {dep?.districts.map((d) => (
        <View key={d.key} style={s.section}>
          <Text style={[s.h3, { fontSize: 12 }]}>{d.name}</Text>
          <Text wrap={false} style={s.tiny}>
            {d.dep.label}
            {d.dep.note ? ` - ${d.dep.note}` : ""} · <Link src={d.dep.url} style={s.link}>source document</Link> · ~
            {Math.round(d.pctInBasin * 100)}% of the district lies in the basin
          </Text>
          {d.counts && <KvRows rows={d.counts} />}
          {d.countsNote && <Text style={[s.tiny, { marginTop: 1 }]}>{d.countsNote}</Text>}
          <ConflictList title="Internal contradictions of the plan" items={d.conflicts} />
          {d.districtThemes.length > 0 && (
            <View style={{ marginTop: 3 }}>
              <Text style={s.h2}>Reported district-wide</Text>
              <DepThemeRows themes={d.districtThemes} />
            </View>
          )}
          {d.ulbs.map((u) => (
            <View key={u.key} style={[s.callout, { borderColor: C.border }]}>
              <Text style={[s.h3, { fontSize: 10 }]}>
                {u.name} ({u.type})
              </Text>
              {u.note && <Text style={s.tiny}>{u.note}</Text>}
              {u.gazette && (
                <Text wrap={false} style={s.tiny}>
                  Gazette: <Link src={u.gazette.url} style={s.link}>{u.gazette.label}</Link>
                </Text>
              )}
              <ConflictList title="Internal contradictions of the plan" items={u.conflicts} />
              <DepThemeRows themes={u.themes} />
            </View>
          ))}
          {d.taluks.map((t) => (
            <View key={t.key} style={[s.callout, { borderColor: C.border }]}>
              <Text style={[s.h3, { fontSize: 10 }]}>{t.label}</Text>
              {t.note && <Text style={s.tiny}>{t.note}</Text>}
              <DepThemeRows themes={t.themes} />
            </View>
          ))}
          {d.industrialAreas && d.industrialAreas.length > 0 && (
            <View style={{ marginTop: 3 }}>
              <Text style={s.h2}>Industrial areas named in the plan</Text>
              <Text style={s.small}>{d.industrialAreas.map((a) => a.name).join(" · ")}</Text>
              {d.industrialAreasNote && <Text style={s.tiny}>{d.industrialAreasNote}</Text>}
              <ConflictList title="Cross-source contradictions" items={d.industrialAreasConflicts} />
            </View>
          )}
        </View>
      ))}

      {dep?.governance && (
        <View style={s.section}>
          <Text style={s.h2}>Governance</Text>
          {dep.governance.items.map((it, i) => (
            <View key={i} style={{ marginBottom: 3 }} wrap={false}>
              <Text style={[s.body, { fontFamily: "Helvetica-Bold" }]}>{it.heading}</Text>
              <Text style={s.small}>{it.body}</Text>
              {it.source && (
                <Text wrap={false} style={s.tiny}>
                  {it.source.source}: {it.source.citation}
                  {it.source.url ? " - " : ""}
                  {it.source.url && <Link src={it.source.url} style={s.link}>{it.source.url}</Link>}
                </Text>
              )}
            </View>
          ))}
          {dep.governance.gaps.map((g, i) => (
            <Bullet key={i} color={C.rose}>
              {g}
            </Bullet>
          ))}
        </View>
      )}

      {/* v1 basins: flat cross-source gap units */}
      {!dep &&
        p.gapUnits.map((u) => (
          <View key={u.name} style={s.section}>
            <Text style={[s.h3, { fontSize: 12 }]}>{u.name}</Text>
            {u.headline && (
              <View style={[s.callout, { borderColor: C.roseBorder, backgroundColor: C.roseBg }]}>
                <Text style={[s.body, { fontFamily: "Helvetica-Bold", color: "#881337" }]}>{u.headline}</Text>
              </View>
            )}
            {u.coverage && <Text style={s.tiny}>Data coverage: {u.coverage}</Text>}
            <ConflictList title="Points to reconcile across sources" items={u.conflicts} />
            <ConflictList title="Notes & caveats" items={u.caveats} />
            {u.streams.map((st, i) => (
              <View key={i} style={[s.callout, { borderColor: C.border }]} wrap={false}>
                <Text style={[s.body, { fontFamily: "Helvetica-Bold" }]}>{st.stream}</Text>
                <Text style={s.small}>{st.summary}</Text>
                {st.metrics.map((m, j) => (
                  <View key={j} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={s.small}>{m.label}</Text>
                    <Text
                      style={[
                        s.small,
                        {
                          color: m.emphasis === "good" ? C.emerald : m.emphasis ? C.rose : C.text,
                          fontFamily: m.emphasis ? "Helvetica-Bold" : "Helvetica",
                        },
                      ]}
                    >
                      {m.value}
                    </Text>
                  </View>
                ))}
                {st.sources.map((src, j) => (
                  <Text wrap={false} key={j} style={s.tiny}>
                    {src.source}: {src.says} ({src.citation}){src.url ? " - " : ""}
                    {src.url && <Link src={src.url} style={s.link}>{src.url}</Link>}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ))}

      <Footer shareUrl={p.shareUrl} />
    </Page>
  );
}

// ── Final page: data & attribution ───────────────────────────────────────────

function CreditsPage(p: BasinReportProps) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.h2}>Data on this map - layers in this export</Text>
      {p.manifest.collaboration && (
        <Text style={[s.small, { marginBottom: 4 }]}>
          {p.manifest.collaboration.label} {p.manifest.collaboration.name}
          {p.manifest.collaboration.url ? ` (${p.manifest.collaboration.url})` : ""}.
        </Text>
      )}
      {p.inventoryRows.length > 0 && (
        <View style={s.kvBox}>
          {p.inventoryRows.map((r, i) => (
            <View key={r.label} style={[s.kvRow, ...(i === 0 ? [s.kvRowFirst] : [])]} wrap={false}>
              <Text style={[s.kvLabel, { width: 220 }]}>{r.label}</Text>
              <Text style={s.kvValue}>{r.count.toLocaleString("en-IN")} features</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.section}>
        <Text style={s.h2}>Attribution</Text>
        {p.manifest.credits.map((c, i) => (
          <Bullet key={i}>{c}</Bullet>
        ))}
        <Bullet>Basemap: (c) OpenStreetMap contributors (openstreetmap.org/copyright).</Bullet>
      </View>
      <View style={s.section}>
        <Text style={s.h2}>About this document</Text>
        <Text style={s.small}>
          Generated {p.generatedAt} from the live Neer Vazhvu Basin Atlas. The map image reflects the exact layer
          selection and viewport at export; every figure in the text pages carries its source. The live, interactive
          version of this exact view: {p.shareUrl}
        </Text>
      </View>
      <Footer shareUrl={p.shareUrl} />
    </Page>
  );
}

export function BasinReportDocument(p: BasinReportProps) {
  return (
    <Document
      title={`${p.manifest.displayName} Atlas - Neer Vazhvu`}
      author="Neer Vazhvu"
      subject={`${p.manifest.displayName} - map state, polluted river stretch and treatment-gap report`}
      creator="Neer Vazhvu Basin Atlas"
    >
      <MapPage {...p} />
      {p.prs && <PrsPages {...p} />}
      {p.includeGaps && (p.dep || p.gapUnits.length > 0) && <GapsPages {...p} />}
      <CreditsPage {...p} />
    </Document>
  );
}
