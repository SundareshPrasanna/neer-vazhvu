import type {
  RiverData,
  RiverQualityReading,
  RiverQualityStatus,
} from "@/types/river-quality";
import { measureWorst } from "@/lib/rivers/measure";

/**
 * Map a single NWMP reading to a CPCB Designated Best-Use class.
 *
 * CPCB defines five classes (A-E) by DO, BOD and total coliform
 * thresholds. Each class corresponds to a designated water use:
 *   A: drinking with disinfection only      (DO >= 6, BOD <= 2)
 *   B: outdoor bathing                      (DO >= 5, BOD <= 3)
 *   C: drinking with conventional treatment (DO >= 4, BOD <= 3)
 *   D: propagation of wildlife / fisheries  (DO >= 4)
 *   E: irrigation, industrial cooling       (BOD any, EC <= 2250)
 * "Below E" means the water fails even Class E (e.g. DO collapsed,
 * BOD double-digit) - effectively "dead" for the rivers we track.
 *
 * Coliform/EC thresholds are checked when the reading carries them
 * but treated as informative-only rather than disqualifying, since
 * gaps in the NWMP feed are common.
 *
 * Returns null when both DO and BOD are absent (can't classify).
 */
function classifyReading(r: RiverQualityReading): RiverQualityStatus | null {
  // Readings may be point values or annual ranges; classify on the end that
  // matters for the threshold so a range never reads as healthier than its
  // worst month.
  const doMg = measureWorst(r.do_mgl, "lower-is-worse");
  const bod = measureWorst(r.bod_mgl, "higher-is-worse");
  if (doMg == null && bod == null) return null;

  // "Dead" - oxygen has effectively collapsed AND/OR BOD is way past
  // any beneficial use threshold. Cooum + Buckingham Canal sit here.
  if ((doMg != null && doMg < 1) || (bod != null && bod > 30)) {
    return "dead";
  }

  // "Severely degraded" - fails Class D (the lowest CPCB class with a
  // DO floor): DO < 4 OR BOD > 6 (the practical fisheries ceiling).
  // Adyar today: DO ~2-3, BOD ~12-29 - cleanly here.
  if ((doMg != null && doMg < 4) || (bod != null && bod > 6)) {
    return "severely_degraded";
  }

  // "Degraded" - meets Class D (fisheries) but fails Class B/C
  // (bathing / drinking-with-treatment). Both classes share the same
  // BOD ceiling of 3 mg/L. Vaigai at Anuppanadi (DO 5.1, BOD 4.2)
  // sits here - oxygen is OK for fisheries, but BOD is too high for
  // bathing or treatable drinking.
  if ((doMg != null && doMg < 5) || (bod != null && bod > 3)) {
    return "degraded";
  }

  // "Stressed" - meets Class B (outdoor bathing) but fails Class A
  // (drinking-with-disinfection-only). Class A demands DO >= 6 and
  // BOD <= 2; anything between B's floor and A's floor is "stressed".
  if ((doMg != null && doMg < 6) || (bod != null && bod > 2)) {
    return "stressed";
  }

  return "healthy";
}

const SEVERITY: Record<RiverQualityStatus, number> = {
  healthy: 0,
  stressed: 1,
  degraded: 2,
  severely_degraded: 3,
  dead: 4,
};

function worse(a: RiverQualityStatus, b: RiverQualityStatus): RiverQualityStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * Compute a river's overall_status from its actual NWMP readings.
 *
 * Methodology (kept simple + auditable):
 *   1. For each station, take the most recent year's reading.
 *   2. Classify that reading via CPCB Designated Best-Use thresholds.
 *   3. The river's overall status is the WORST classification across
 *      its stations - because if any monitored stretch is dead, the
 *      river isn't healthy anywhere downstream of it.
 *
 * Returns the JSON-declared `overall_status` as a fallback when
 * no station has any classifiable reading (e.g. Kosasthalaiyar today,
 * which has zero NWMP stations). This lets us preserve hand-curated
 * status for rivers whose data hasn't been wired up yet.
 *
 * Pure function - no side effects, no dependencies on framework code.
 */
export function computeRiverStatus(river: RiverData): RiverQualityStatus {
  let worst: RiverQualityStatus | null = null;

  for (const station of river.stations) {
    if (!station.readings || station.readings.length === 0) continue;
    const sorted = [...station.readings].sort((a, b) => b.year - a.year);
    const latest = sorted[0];
    const status = classifyReading(latest);
    if (!status) continue;
    worst = worst == null ? status : worse(worst, status);
  }

  return worst ?? river.overall_status;
}

/** Boolean form for the common "anything-bad-or-worse" guard. */
export function isBadStatus(status: RiverQualityStatus): boolean {
  return SEVERITY[status] >= SEVERITY.degraded;
}

export const RIVER_CLASSIFICATION_NOTE_KEY = "rivers.classification_note";
