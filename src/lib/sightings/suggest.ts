/**
 * As-you-type place suggestions for the report map, matched against the places we cover (suggest-server.ts builds the
 * index from our own static files). Pure: normalising, matching, ranking, the ward label and a point inside a shape.
 */
import type { GeoJsonProperties, MultiPolygon, Polygon, Position } from "geojson";

import { wardNumberOf } from "@/lib/utils/ward-number";

export type SuggestKind = "lake" | "ward" | "village" | "town";

/** One suggestion as the API returns it. */
export interface Suggestion {
  label: string;
  kind: SuggestKind;
  lat: number;
  lng: number;
  waterBodyId?: string;
}

/**
 * An index entry. Word fields are space-padded (" ambattur ") so " am" finds the start of a word and " ambattur " a
 * whole word, with no splitting at query time; the loose fields are the same words through `fold`.
 */
export interface SuggestEntry {
  label: string;
  kind: SuggestKind;
  lat: number;
  lng: number;
  id: string | null;
  /** The place's own name: " ambattur ", " ward 82 ". Lake words (`LAKE_WORDS`) left out. */
  name: string;
  /** Where it is, as the label says it: " ambattur chennai ". */
  ctx: string;
  nameLoose: string;
  ctxLoose: string;
}

export const SUGGEST_MIN = 2;
export const SUGGEST_MAX = 8;
const QUERY_MAX = 80;

/** Words that only say "a lake", in the languages our places use: shown in labels, ignored when matching. */
const LAKE_WORDS = new Set([
  "lake", "lakes", "eri", "ery", "kere", "kare", "tank", "tanks", "pond", "ponds", "kulam", "kuttai", "kunta", "cheruvu",
  "talab", "talav", "talao", "sarovar", "reservoir",
]);

/** Lower case, accents off Latin letters, anything but letters, digits and marks as one space. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}

/** The query as sent and matched: normalised and capped. Empty or one character means "no suggestions". */
export function suggestQuery(text: string): string {
  return normalize(text.slice(0, QUERY_MAX));
}

export const longEnough = (q: string) => q.replace(/ /g, "").length >= SUGGEST_MIN;

/** Flowing water and drains that city files map as areas, and placeholders: never offered as a lake. */
const NOT_A_LAKE = /^unnamed\b|\b(river|nadi|nallah|nalla|nala|nullah|creek|khal|canal|drain|stream|channel|odai|estuary)\b/i;
export const lakeName = (name: string | null): string | null => (name && !NOT_A_LAKE.test(name) ? name : null);

/**
 * Spellings that differ the cheap way: Puzhal and Puzal, Chembarambakkam and Chembarambakam, Velachery and Velacheri,
 * Poonamallee and Punamalli, Thiruvallur and Tiruvallur. Applied to both sides, so it only has to be consistent.
 */
export function fold(s: string): string {
  return s
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/([^aeiou\d\s])h/g, "$1")
    .replace(/y/g, "i")
    .replace(/w/g, "v")
    .replace(/(\S)\1+/g, "$1");
}

/** ALL-CAPS register names (AMBATTUR, H.D.KOTE) as Ambattur and H.D.Kote; mixed case is kept as written. */
export function titleCase(s: string): string {
  return /\p{Ll}/u.test(s) ? s : s.replace(/\p{L}+/gu, (w) => w[0] + w.slice(1).toLowerCase());
}

const pad = (words: string[]) => ` ${words.join(" ")} `;

function nameWords(text: string): string[] {
  const all = normalize(text).split(" ").filter(Boolean);
  const own = all.filter((w) => !LAKE_WORDS.has(w));
  return own.length ? own : all;
}

/** What one index entry is made from: `name` and `ctx` are display text, normalised here. */
export interface EntryInput {
  label: string;
  kind: SuggestKind;
  lat: number;
  lng: number;
  id?: string | null;
  name: string;
  ctx: (string | null | undefined)[];
}

/** One spelling of the same lake within this distance is one lake (a lake split into several outlines, or in two files). */
export const SAME_LAKE_KM = 1.5;
const SAME_LABEL_KM = 5;

/** Collects entries; context strings are shared between entries, and a lake already added nearby by name is skipped. */
export function indexBuilder() {
  const entries: SuggestEntry[] = [];
  const contexts = new Map<string, [string, string]>();
  const lakes = new Map<string, SuggestEntry[]>();
  return {
    entries,
    add(x: EntryInput): boolean {
      const name = pad(nameWords(x.name));
      if (name.trim() === "") return false;
      if (x.kind === "lake" && (lakes.get(name) ?? []).some((e) => km(e, x) <= SAME_LAKE_KM)) return false;
      const ctxKey = pad(x.ctx.filter((c): c is string => !!c).flatMap((c) => normalize(c).split(" ").filter(Boolean)));
      if (!contexts.has(ctxKey)) contexts.set(ctxKey, [ctxKey, fold(ctxKey)]);
      const [ctx, ctxLoose] = contexts.get(ctxKey)!;
      const loose = fold(name);
      const e: SuggestEntry = {
        label: x.label,
        kind: x.kind,
        lat: round(x.lat),
        lng: round(x.lng),
        id: x.id ?? null,
        name,
        ctx,
        nameLoose: loose === name ? name : loose,
        ctxLoose,
      };
      entries.push(e);
      if (x.kind === "lake") lakes.set(name, [...(lakes.get(name) ?? []), e]);
      return true;
    },
  };
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Kilometres between two points (equirectangular: plenty for ranking). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dx = (a.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180);
  const dy = a.lat - b.lat;
  return Math.sqrt(dx * dx + dy * dy) * 111.2;
}

/**
 * How well one query word matches an entry, best first: 0 a whole word of the name, 1 the start of a word of the name,
 * 2 the start of a word of where it is (zone, block, city), 3 inside a word of the name, 4 the start of a word after
 * `fold`, 5 inside the name after `fold`; -1 no match. Inside-a-word matches need 3 letters.
 */
function quality(e: SuggestEntry, t: { whole: string; start: string; bare: string; loose: string; looseStart: string }): number {
  if (e.name.includes(t.whole)) return 0;
  if (e.name.includes(t.start)) return 1;
  if (e.ctx.includes(t.start)) return 2;
  if (t.bare.length < 3) return -1;
  if (e.name.includes(t.bare)) return 3;
  if (e.nameLoose.includes(t.looseStart) || e.ctxLoose.includes(t.looseStart)) return 4;
  return e.nameLoose.includes(t.loose) ? 5 : -1;
}

const KIND_ORDER: Record<SuggestKind, number> = { lake: 0, ward: 1, town: 2, village: 3 };

/**
 * The best matches for a query, at most `limit`. Every query word must match (lake words are dropped unless the query
 * is only lake words, which lists lakes). Order: the worst-matching word's quality (start of a word before inside a
 * word, spelling-tolerant last); a name that starts with the first word; more whole words; nearer to `near`; lakes,
 * wards, towns, villages; shorter label.
 */
export function suggest(entries: SuggestEntry[], query: string, near?: { lat: number; lng: number } | null, limit = SUGGEST_MAX): Suggestion[] {
  const q = suggestQuery(query);
  if (!longEnough(q)) return [];
  const all = q.split(" ");
  const own = all.filter((w) => !LAKE_WORDS.has(w));
  const ranked: { e: SuggestEntry; worst: number; lead: number; whole: number; d: number }[] = [];
  const dist = (e: SuggestEntry) => (near ? km(e, near) : 0);

  if (!own.length) {
    // "lake", "eri", "pond": lakes, those whose label says the word first.
    for (const e of entries) {
      if (e.kind !== "lake") continue;
      const said = all.every((w) => normalize(e.label).split(" ").includes(w));
      ranked.push({ e, worst: said ? 0 : 1, lead: 0, whole: 0, d: dist(e) });
    }
  } else {
    const tokens = own.map((w) => ({ whole: ` ${w} `, start: ` ${w}`, bare: w, loose: fold(w), looseStart: ` ${fold(w)}` }));
    const joined = own.join("");
    for (const e of entries) {
      let worst = 0;
      let whole = 0;
      for (const t of tokens) {
        const k = quality(e, t);
        if (k < 0) {
          worst = -1;
          break;
        }
        worst = Math.max(worst, k);
        if (k === 0 || e.ctx.includes(t.whole)) whole++;
      }
      // Spaced differently: "hd kote" for H.D.Kote, "chembaram bakkam", "ward82" (the whole name: as good as its words).
      let same = false;
      if (worst < 0 && joined.length >= 3) {
        const compact = e.name.replace(/ /g, "");
        same = compact === joined;
        if (same) [worst, whole] = [0, tokens.length];
        else if (compact.includes(joined)) [worst, whole] = [3, 0];
      }
      if (worst < 0) continue;
      // A ward's own name is its number: "82" leads for Ward 82 as "ambattur" does for Ambattur Lake.
      const lead = same || e.name.startsWith(tokens[0].start) || (e.kind === "ward" && e.name.startsWith(` ward${tokens[0].start}`));
      ranked.push({ e, worst, lead: lead ? 0 : 1, whole, d: dist(e) });
    }
  }

  ranked.sort(
    (a, b) =>
      a.worst - b.worst ||
      a.lead - b.lead ||
      b.whole - a.whole ||
      a.d - b.d ||
      KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] ||
      a.e.label.length - b.e.label.length ||
      a.e.label.localeCompare(b.e.label),
  );
  // One big lake mapped as several outlines far apart (Himayat Sagar) shows once; namesakes further apart all show.
  const kept: SuggestEntry[] = [];
  for (const { e } of ranked) {
    if (kept.length === limit) break;
    if (!kept.some((k) => k.label === e.label && km(k, e) <= SAME_LABEL_KM)) kept.push(e);
  }
  return kept.map((e) => ({ label: e.label, kind: e.kind, lat: e.lat, lng: e.lng, ...(e.id && { waterBodyId: e.id }) }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Building entries from the files.

/**
 * A ward's label and words from its boundary feature. The number people use: the label's own prefix where the file has
 * one (Bengaluru's per-corporation "25 - Vinayaka Layout", Mumbai's "A - Colaba / Fort"), else the ward number. Its
 * name where the file names wards; else the zone, when the zone is a place name (Chennai's AMBATTUR) and not a
 * "West Zone-V". Nagpur's "Prabhag 12" also matches "prabhag 12".
 */
export function wardParts(p: GeoJsonProperties, city: string): Pick<EntryInput, "label" | "name" | "ctx"> | null {
  const n = wardNumberOf(p);
  if (n == null) return null;
  const tag = typeof p?.ward_label === "string" ? p.ward_label.split(" - ")[0].trim() : "";
  const num = tag && tag.length <= 6 ? tag : String(n);
  const raw = typeof p?.ward_name === "string" ? p.ward_name.trim() : "";
  const generic = /^\d+$/.test(raw) || /^(ward|prabhag)\s*\d+$/i.test(raw);
  const own = raw && !generic ? titleCase(raw) : null;
  const zoneRaw = [p?.Zone_Name, p?.zone_name].find((z): z is string => typeof z === "string" && !!z.trim())?.trim();
  const zone = !own && zoneRaw && !/\bzone\b/i.test(zoneRaw) ? titleCase(zoneRaw) : null;
  return {
    label: [`Ward ${num}`, own ?? zone, city].filter(Boolean).join(", "),
    name: [`Ward ${num}`, own, generic && /^prabhag/i.test(raw) ? raw : null].filter(Boolean).join(" "),
    ctx: [zone, city],
  };
}

const ringArea = (r: Position[]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

/** Even-odd across every ring, so a point in a hole (an island) is outside. */
function insideRings(x: number, y: number, rings: Position[][]): boolean {
  let inside = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/**
 * A point inside the shape's largest part, as [lng, lat]: its centroid when that falls inside (most lakes and wards),
 * else the middle of the widest stretch of the horizontal line through the centroid (a crescent, a ring of land). The
 * pin lands there, so the place it names is the place the report is bound to.
 */
export function labelPoint(g: Polygon | MultiPolygon): [number, number] | null {
  const parts = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let best: Position[][] | null = null;
  let bestArea = -1;
  for (const p of parts) {
    const a = p[0]?.length ? Math.abs(ringArea(p[0])) : -1;
    if (a > bestArea) [best, bestArea] = [p, a];
  }
  const outer = best?.[0];
  if (!best || !outer?.length) return null;

  let cx = 0;
  let cy = 0;
  let a2 = 0;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const f = outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1];
    cx += (outer[j][0] + outer[i][0]) * f;
    cy += (outer[j][1] + outer[i][1]) * f;
    a2 += f;
  }
  const [x, y] = a2 ? [cx / (3 * a2), cy / (3 * a2)] : [outer[0][0], outer[0][1]];
  if (insideRings(x, y, best)) return [x, y];

  const xs: number[] = [];
  for (const r of best) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  xs.sort((p, q) => p - q);
  let mid: number | null = null;
  let span = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > span) [span, mid] = [xs[i + 1] - xs[i], (xs[i] + xs[i + 1]) / 2];
  }
  return mid == null ? [outer[0][0], outer[0][1]] : [mid, y];
}
