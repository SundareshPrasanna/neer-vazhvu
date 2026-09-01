import { foldTamilPlaceName } from "./tn-crosswalk";

/**
 * Minimum similarity before a pairing may be proposed at all.
 *
 * Measured against the known Tamil Nadu block variants, which score 0.867 and
 * above (Thanthaiyangarpet against Tattayyangarpettai is the worst real pair),
 * and against unrelated names in the same district, which score 0.44 and
 * below. Chathirappatti against P.N. Chathiram sits at 0.444 and is exactly
 * the kind of pairing that should be left unproposed rather than suggested.
 */
export const PROPOSAL_MIN_SIMILARITY = 0.6;

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let previous = Array.from({ length: n + 1 }, (_, index) => index);
  for (let i = 1; i <= m; i += 1) {
    const current = [i];
    for (let j = 1; j <= n; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[n];
}

/**
 * Similarity of two place names after transliteration folding, so that
 * spelling variance the fold already handles does not count against a pair.
 */
export function foldedSimilarity(left: string, right: string): number {
  const a = foldTamilPlaceName(left);
  const b = foldTamilPlaceName(right);
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  return Number(
    (1 - levenshtein(a, b) / Math.max(a.length, b.length)).toFixed(4),
  );
}

export interface SimilarityChoice<T> {
  candidate: T;
  similarity: number;
}

/**
 * Picks the single best candidate, or nothing.
 *
 * Returns null when the best candidate is below the threshold, and also when
 * two candidates tie at the top: a coin flip between equally plausible
 * Panchayats is not a proposal, it is a guess wearing one's clothes.
 */
export function bestCandidate<T>(
  name: string,
  candidates: T[],
  nameOf: (candidate: T) => string,
  minimum = PROPOSAL_MIN_SIMILARITY,
): SimilarityChoice<T> | null {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      similarity: foldedSimilarity(name, nameOf(candidate)),
    }))
    .sort((left, right) => right.similarity - left.similarity);
  if (scored.length === 0) return null;
  const best = scored[0];
  if (best.similarity < minimum) return null;
  if (scored.length > 1 && scored[1].similarity === best.similarity) return null;
  return best;
}
