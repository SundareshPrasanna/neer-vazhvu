/**
 * The landing board's place search: one matcher over cities, districts and
 * states. Pure and registry-free, so the client bundle carries only the
 * terms the page passes in (src/lib/places/terms.ts builds them).
 */

export type PlaceSearchKind = "city" | "district" | "state";

export interface PlaceTerms {
  /** "city:<cityId>", "district:<scopeId>" or "state:<stateSlug>". */
  id: string;
  kind: PlaceSearchKind;
  name: string;
  /** Other names it is found by: local script, aliases, state, authority. */
  terms: string[];
}

/** Score tiers, highest first. CONFIDENT and above means the visitor found
 *  their place; below it, the board still offers a request. */
export const SCORE = { exact: 4, name: 3, term: 2, fuzzy: 1 } as const;
export const CONFIDENT = SCORE.term;

/** Lowercase, Latin accents stripped, punctuation to spaces. Indic vowel
 *  signs are kept: they are letters there, not accents. */
export function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/** Levenshtein distance of at most `max`, with an early exit. */
function within(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...row) > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

// One typo from five letters, two from nine ("Vishakapatnam"); none below
// five, where one edit turns most names into another.
const maxEdits = (len: number) => (len >= 9 ? 2 : len >= 5 ? 1 : 0);

/** 2: every query word starts a word of the field (or the query, spaces
 *  dropped, starts the field: "navimumbai"); 1: the same with typos; 0: no. */
function fieldMatch(words: string[], squashed: string, field: string): 0 | 1 | 2 {
  const n = normalise(field);
  if (n.replaceAll(" ", "").startsWith(squashed)) return 2;
  const fieldWords = n.split(" ");
  let typo = false;
  for (const w of words) {
    if (fieldWords.some((f) => f.startsWith(w))) continue;
    const max = maxEdits(w.length);
    if (max && fieldWords.some((f) => within(w, f, max))) typo = true;
    else return 0;
  }
  return typo ? 1 : 2;
}

export function scorePlace(query: string, place: PlaceTerms): number {
  const q = normalise(query);
  if (!q) return 0;
  const words = q.split(" ");
  const squashed = words.join("");
  if (normalise(place.name).replaceAll(" ", "") === squashed) return SCORE.exact;
  const byName = fieldMatch(words, squashed, place.name);
  if (byName === 2) return SCORE.name;
  const byTerm = Math.max(0, ...place.terms.map((t) => fieldMatch(words, squashed, t)));
  if (byTerm === 2) return SCORE.term;
  return byName || byTerm ? SCORE.fuzzy : 0;
}

/** Matching places, best first; ties keep the board's own order. */
export function searchPlaces<T extends PlaceTerms>(query: string, places: T[]): { place: T; score: number }[] {
  return places
    .map((place, i) => ({ place, i, score: scorePlace(query, place) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ place, score }) => ({ place, score }));
}
