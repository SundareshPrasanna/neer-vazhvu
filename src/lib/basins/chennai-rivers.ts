import type { BasinManifest } from "./types";

// Chennai rivers (Cooum & Adyar) - a city-scoped Basin Atlas instance whose
// focus is the treatment-gap / waste intelligence layer, not a full
// hydrological basin. Mirrors the Arkavathi contract: one manifest + GeoJSON
// under public/data/basins/chennai-rivers/. Gap panel content in gaps.json.
//
// Unlike Arkavathi there are no India-WRIS sub-hydrosheds here, so river
// click-scope is empty (the river still draws + carries its narrative); the
// value is the governance floor (gaps + STP locations + discharge points).
export const CHENNAI_RIVERS: BasinManifest = {
  basinId: "chennai-rivers",
  cityIds: ["chennai"],
  displayName: "Cooum & Adyar (Chennai)",
  blurb:
    "Chennai's two city rivers, the Cooum and the Adyar, are among the most polluted stretches in the country - not from industry but from the city's own sewage. About 243 MLD of raw sewage bypasses the treatment plants into them daily, even as the STPs run well below capacity. Click a river to open the treatment-and-waste gap view.",
  mapCenter: [13.06, 80.22],
  mapZoom: 11,
  rivers: [
    {
      riverId: "cooum",
      displayName: "Cooum",
      displayNameLocal: "கூவம் ஆறு",
      subHydroshedIds: ["COOUM"],
      color: "#2563eb",
      narrative:
        "The Cooum runs ~42 km west-to-east through the heart of Chennai to the Bay of Bengal. CPCB rates it among the most polluted river stretches in India; the pollution is overwhelmingly municipal sewage, let out through dozens of stormwater-drain inlets along its length.",
    },
    {
      riverId: "adyar",
      displayName: "Adyar",
      displayNameLocal: "அடையாறு",
      subHydroshedIds: ["ADYAR"],
      color: "#2563eb",
      narrative:
        "The Adyar drains south Chennai over ~57 km to the coast at the Adyar estuary. Like the Cooum it carries the city's untreated sewage; the CAG put the raw-sewage bypass into the Adyar, Buckingham Canal and Cooum at 242.73 MLD as of 2019.",
    },
    {
      riverId: "kosasthalaiyar",
      displayName: "Kosasthalaiyar",
      displayNameLocal: "கொசஸ்தலையாறு",
      subHydroshedIds: ["KOSAS"],
      color: "#2563eb",
      narrative:
        "The northern of Chennai's three rivers, draining past the Ennore industrial-thermal belt to the Pulicat backwaters. Carries both sewage and the north-Chennai industrial load.",
    },
    {
      riverId: "buckingham-canal",
      displayName: "Buckingham Canal",
      displayNameLocal: "பக்கிங்காம் கால்வாய்",
      // Artificial N-S coastal navigation canal, not a natural catchment - it
      // cuts across all three river sheds, so it carries no shed of its own.
      subHydroshedIds: [],
      color: "#0891b2",
      narrative:
        "A ~796 km colonial-era navigation canal running north-south along the coast; through Chennai it links the Kosasthalaiyar, Cooum and Adyar. Long defunct for navigation, it now functions largely as a sewage carrier - the CAG named it alongside the Cooum and Adyar as a recipient of the 242.73 MLD raw-sewage bypass.",
    },
  ],
  layers: [
    // Structural context
    { family: "boundary", label: "Chennai (GCC) boundary", floor: "hydrology", geom: "fill", color: "#d946ef", defaultOn: true, context: true },
    { family: "sub-hydrosheds", label: "River sub-catchments", floor: "hydrology", geom: "fill", color: "#818cf8", defaultOn: true, context: true },
    { family: "rivers", label: "Rivers & canals", floor: "hydrology", geom: "line", color: "#2563eb", defaultOn: true, context: true },

    // Monitoring & evidence
    { family: "monitoring-points", label: "CPCB water-quality stations", floor: "monitoring", geom: "point", color: "#059669", defaultOn: true },
    { family: "evidence-points", label: "Sewage inlets into the Cooum (with flow)", floor: "monitoring", geom: "point", color: "#f43f5e", defaultOn: true },

    // Pressures - where sewage is generated but not sewered (-> septic tanks)
    { family: "uncollected-sewage", label: "Unsewered areas (sewage to septic tanks)", floor: "pressures", geom: "point", color: "#f59e0b", defaultOn: true },

    // Gaps & response (governance floor)
    { family: "gaps", label: "Treatment & waste gap (per river)", floor: "governance", geom: "fill", color: "#dc2626", defaultOn: true, gap: true },
    { family: "infrastructure", label: "Sewage treatment plants (STPs)", floor: "governance", geom: "point", color: "#a855f7", defaultOn: true },
  ],
  credits: [
    "Sewage gap figures: CAG Report on General & Social Sector, Tamil Nadu, year ended March 2019 (CMWSSB performance audit).",
    "STP capacities & locations: CMWSSB Sewerage System; Chennai sewerage network (CMWSSB / OpenCity).",
    "Cooum sewage-inlet flows: compiled from CMWSSB / Chennai River Restoration Trust sources.",
    "Solid-waste figures: Greater Chennai Corporation - Solid Waste Management department (2024).",
    "Boundary: Greater Chennai Corporation ward map (2022), dissolved.",
  ],
};
