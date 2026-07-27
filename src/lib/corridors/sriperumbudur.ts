import type { CorridorManifest } from "./types";

/**
 * Pilot corridor: the Sriperumbudur-Oragadam belt west and southwest of
 * Chennai (auto, electronics, semiconductor and data-center investments
 * across SIPCOT parks in Kancheepuram, Chengalpattu and Tiruvallur
 * districts). Data build: scripts/build_corridor_sriperumbudur.py; every
 * number is cross-checked by scripts/verify_corridor_assessment.py before
 * publication (DECISIONS.md D12d).
 */
export const SRIPERUMBUDUR: CorridorManifest = {
  corridorId: "sriperumbudur",
  displayName: "Sriperumbudur-Oragadam Industrial Corridor",
  shortName: "Sriperumbudur-Oragadam",
  stateCode: "TN",
  districts: ["Kancheepuram", "Chengalpattu", "Tiruvallur"],
  center: [12.93, 79.98],
  zoom: 10,
  description:
    "What the aquifer under Chennai's manufacturing belt is actually doing: the regulator's own groundwater assessment, firka by firka, with SIPCOT park boundaries, trends across three editions, and the rules that apply.",
  editions: ["2023", "2024", "2025"],
  latestEdition: "2025",
  unitNoun: "firka",
};
