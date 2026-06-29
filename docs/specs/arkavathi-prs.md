# Arkavathi Polluted River Stretch (PRS) - design spec

Status: BUILT 2026-06-29 (pending review + merge). Branch `arkavathi-prs` (off main).
All four stressor tabs live: Sewage + Solid waste = generic `UnitTimeline` (generated-vs-treated/
processed single bar per year + infrastructure track); Industrial effluent + PRS = narrative
`categories` (Discharges/Areas/Clusters; PRS/E-flow/Flood/Evidence). Map has a 2020->2025 growth
toggle (orange 2020 under red 2025). The timeline + category renderers are theme-generic
(unitLabel MLD/TPD, treatedVerb treated/processed) so a tab is pure prs.json data.
Partner: Paani Earth (rough design in `docs/partnerships/paani_partnership/PRS_Visualization.pdf`).

## Goal

Make the **Polluted River Stretch the entry point** to the Arkavathi pollution story. The PRS is
the CPCB/NGT-classified stretch monitored through NMCG Monthly Progress Reports (MPRs). It becomes
the spine that organises the stressor evidence we already hold in the Basin Atlas - led by a single
conclusion, and forward-compatible with the unified-map "Question" primitive.

## What the data says (verified from the partner gpkgs)

`Arkavathi_PRS_Stretch_2020.gpkg` and `..._2025.gpkg` are each a single LineString (EPSG:3857,
`rivname=Arkavati`, `Length` in km). Reprojected to 4326, geodesic length confirms the attribute:

- **2020: 65.6 km, CPCB Priority III**
- **2025: 104.0 km, CPCB Priority I**

The stretch GREW ~58% and WORSENED two priority bands (lower number = worse; Priority I is the worst
CPCB band). The 2025 growth is **upstream, into Bengaluru's urban core**: the new length sits in
Bengaluru North (~19 km) and Yelahanka (~14 km), with Bangalore-South roughly doubling. The southern
(Kanakapura) and central (Ramanagara/Magadi) reaches are unchanged.

Taluks each stretch crosses (intersection length, approximate):

| Taluk            | 2020 | 2025 | gaps unit   |
|------------------|------|------|-------------|
| Ramanagara       | 31   | 31   | ramanagara  |
| Bengaluru North  | -    | 19   | bbmp        |
| Yelahanka        | -    | 14   | yelahanka   |
| Bangalore-South  | 7    | 14   | bbmp        |
| Kanakapura       | 13   | 13   | kanakapura  |
| Magadi           | 10   | 10   | magadi      |
| Harohalli        | 4    | 4    | harohalli   |
| Nelamangala      | <1   | <1   | (negligible)|

Every crossed taluk already has a gaps-intelligence unit, so V1 wires existing data - no new
extraction needed.

## Confirmed decisions

Initial (2026-06-28): extend the Basin Atlas on a fresh branch off main; V1 = the PRS spine wiring
existing layers; shape the entry as a reusable contract.

Revised after live review (2026-06-29):
1. **Right panel = TABS + SUBTABS** (not the first-cut accordion). Tabs = stressor themes
   (Sewage / Industrial effluent / Solid waste / PRS / Water sources / Water-bodies status). The
   subtab axis differs per tab: Sewage = admin units along the stretch; Industrial = Discharges /
   Areas / Contaminated clusters; PRS = PRS / E-flow / Flood plains / Evidence; Solid = domestic /
   biomedical / C&D / processing.
2. **Each tab+subtab shows two parallel 2021-2025 tracks** (per PDF p.3): generation statistics and
   the infrastructure built + status. (Supersedes the earlier "no new timeline UI" call.)
3. **V1 builds the Sewage tab as the reference**, fully (tabs + admin-unit subtabs + dual timeline),
   with the other tabs shown but flagged "soon" and listing their sub-themes. Replicating to the
   other tabs is data-only once the pattern is signed off.
4. **Left rail** is checkbox-only (cross-floor layers combine; PRS + gaps together) with an
   accordion that opens only the entry floor by default; PRS always draws on top so it stays
   clickable.

The Sewage tab's per-unit timelines are authored in `prs.json` from the gaps/NMCG data we hold
(Ramanagara has a real 2021-2025 series; others are single-year + flagged where a DEP would complete
them). Partner can supply DEPs (2021 baseline + 2024-25 refresh) for BBMP/Yelahanka, Magadi,
Harohalli; they slot in as data-only edits to `prs.json`.

## Surface (V1, on the atlas)

- **New `prs` layer family.** `public/data/basins/arkavathi/prs.geojson` = 2 LineStrings tagged
  `year` (2020|2025), `priority` (III|I), `length_km`, `label`, `source`. Rendered on the Hydrology
  floor near the top of the elevator: 2020 thin/muted, 2025 bold red. Clickable.
- **Entry:** clicking the stretch (either year) opens the PRS panel on the right. Coach mark points
  to it ("This stretch is officially polluted - see how and why").
- **Right panel = `PRSPanel` (accordion).** Content authored in
  `public/data/basins/arkavathi/prs.json`:
  - **Conclusion header:** the 2020->2025 length bar + Priority chips (III -> I), one-sentence
    takeaway.
  - **Constructive BOD caveat:** priority is BOD-only, grab-sample; BOD needs flow context
    (concentration vs dilution). Phrased per the partner's "constructive" rule.
  - **Stressor sub-sections** (collapsible), each reading from the gaps streams of the units the
    2025 stretch crosses: Sewage, Industrial effluent, Solid waste, FSTP, Evidence. Each row shows a
    scannable status + the "what's missing" gap + a citation; expanding shows the cross-source detail
    and trend already rendered by the gaps layer. Themes with no data yet (E-flow, Flood plain,
    Treated-water reuse) appear as explicit "no known public data" rows (honest-gaps principle), not
    hidden.
  - **Industries draining into this stretch** - count + list, derived from `pressures` features
    within a buffer of the 2025 stretch (spatial estimate, labelled as such).
  - **NMCG grievance portal** link (citizen action; "report illegal discharge").
  - **Source/credit footer:** Paani Earth (stretch geometry), NMCG MPRs, CAG, CPCB.

## Question contract (forward-compat with unified map)

Author the entry as a Question-shaped record (ask / conclusionKey / resolvesTo:map / composes the
prs + pressures + gaps layers / availableWhen bangalore). In the atlas it boots the PRS panel; in the
unified map it becomes a first-class question with zero rework. Example ask:
"Is the Arkavathi getting cleaner or more polluted?" -> conclusion "It is getting worse: the
officially polluted stretch grew from 66 km to 104 km and worsened from Priority III to Priority I
between 2020 and 2025."

## Scaling to other rivers (Cauvery, Ganga, ...) - NO river-specific code

This is a data + manifest contract, not a feature per river. There is zero "Arkavathi" in the
component logic: `PRSPanel` / `SewageUnitTimeline` render whatever `prs.json` + the manifest
provide, and the `prs` layer behaviour keys off the generic `BasinLayer.prs` flag (styling,
click-to-open-panel, draw-on-top, prs.json fetch). Onboarding a new river is three data steps:

1. **Manifest:** add one layer to the basin's manifest -
   `{ family: "prs", label: "Polluted stretch (PRS)", floor: "hydrology", geom: "line", color: "#b91c1c", defaultOn: true, prs: true }`.
2. **Geometry:** add a basin entry to `scripts/prs-sources.json` (srcDir + per-year file + priority)
   and run `python scripts/build_prs.py <basinId>` -> `public/data/basins/<basinId>/prs.geojson`.
   The script is river-agnostic; no code change.
3. **Panel content:** author `public/data/basins/<basinId>/prs.json` (conclusion, comparison, BOD
   caveat, the tabs + per-tab subtabs/units + timelines, grievance, gaps, sources).

No new component, type, or route. The partner's framing ("most stressors are addressed by NGT orders
that apply to all river basins") matches this exactly.

## Data audit (2026-06-29)

A coverage audit of the gaps/MPR/DEP extractions found and fixed:
- **Priority RESOLVED to I (authoritative CPCB).** Long saga: the gpkg has no priority field; the
  "I" traced to Paani's rough PDF. The June-2025 NMCG MPR listed III (so I briefly "corrected" to
  III) - but that MPR PREDATED the reclassification. The authoritative **CPCB "Polluted River
  Stretches - 2025", October 2025 Updated Version** (fetched via `curl -k` + pdftotext, broken-TLS
  domain; saved at docs/partnerships/paani_partnership/CPCB_PRS_2025_Oct.txt) classifies the
  Arkavathi (**Hesaraghatta reservoir -> d/s Kanakapura**) as **Priority I, BOD 72 mg/L** (entry #39
  national, #1 Karnataka), on 2022-23 data. So trajectory = V (2011) -> III (2018, ~51 km) -> **I
  (2025)**; the stretch's upstream end moved to Hesaraghatta (BOD 72, the worst point), matching
  Paani's mapped upstream growth. Per-location BOD: Hesaraghatta 72, d/s Kanakapura 46, Tippagonda-
  nahalli 21, Manchanabale 11. Chip = I; conclusion/priorityNote/PRS-tab cite CPCB Oct-2025.
  (Aside: Adyar + Cooum are also Priority I in the same report - a hook for a Chennai PRS later,
  since the surface is a generic contract.) The **Feb-2026 NMCG MPR** (saved at
  docs/partnerships/paani_partnership/MPR_Feb2026.txt) adds a documented **central-vs-state
  divergence**: its PRS table lists Arkavathi as CPCB Priority I, but its narrative states KSPCB's
  own Central-Lab 2022-23 analysis puts it at **Priority IV**. Both are now shown (priorityNote +
  PRS tab) - the headline "different datasets tell different parts of the story", applied to the
  priority itself. Feb-2026 also refreshed the V-Valley STP (150 MLD commissioned, running ~70 MLD)
  + a new Hesaraghatta 3 MLD STP under construction.
  The June-2025 MPR also gave real status for the previously "no data" themes - E-flow (CNNL action
  plan not submitted), Flood plains (encroachment details being obtained), and BOD evidence (NWMP
  Mar2024-May2025: up to 30 mg/L at Thippagondanahalli, 52 mg/L d/s Kanakapura, DO often <4) - all
  now wired; and Kanakapura STP corrected to non-complying (+ Rs 30 cr upgrade DPR).
- **Ramanagara SWM number error.** gaps.json said 35 generated / 20 processed; the detailed MPR
  extraction (consistent 2020 + 2025) says 40 generated / 35 collected / ~15 processed (10 in 2020).
  Corrected in both prs.json and gaps.json; CONFIRMED 2026-06-29 from the June-2025 MPR per-ULB SWM
  table (user-supplied): Ramanagara 40/15 (facility 18 TPD), Kanakapura 24/10 (facility 24 TPD, under
  construction), state total 64/25. Kanakapura processed + both facility capacities now wired in.
- **Depth existed but wasn't surfaced.** The MPRs carry per-year V-Valley (BBMP in-basin) +
  Ramanagara figures 2020-2025; only V-Valley + Ramanagara are itemised (other ULBs = single DEP
  snapshots). Wired the Ramanagara SWM 2020-2025 series and the V-Valley industrial series
  (industries 144->191; ~4.7 MLD trade effluent; 14 units->CETP, flat). Most series are flat
  (restated), which is itself the finding.
- **Still blocked / deferred:** official CPCB 2022/2025 Arkavathi class; newer DEP vintages
  (Ramanagara, Bengaluru Urban/Rural) for per-year Magadi/Harohalli/Kanakapura/Yelahanka - Paani
  to send, or fetch from the NGT/KSPCB DEP portal.

## Data-availability pass (2026-06-29)

Pulled all 6 NMCG MPRs 2020-2026 (curl -sk + pdftotext; saved as MPR_*.txt in the partnership
folder). STRUCTURAL FINDING: the Arkavathi PRS section of every MPR itemises only **CMC Ramanagara
+ CMC Kanakapura** (the two ULBs on the monitored stretch) plus the **V-Valley catchment** (BBMP
industrial, the upstream source). Magadi / Harohalli / Yelahanka / BBMP-municipal are NOT separately
reported in the PRS MPRs - they appear in our panel only because Paani's 2025 geometry crosses them,
fed by single DEP snapshots. So their thinness is structural, not a fetch gap.
- Enriched: Kanakapura sewage 2025 -> full **2021-2025 series** (6.29 MLD cap / 3.8 treated, frozen;
  STP non-complying every year - same persistent-gap story as Ramanagara). Sewage tab intro now
  states the PRS-reporting scope so the other taluks read as basin context, not missing data.
- Not wired (low-confidence from grep): multi-year SWM for Kanakapura (2021/22 lines were state
  totals; 2023/24 collected-vs-generated ambiguous) - needs careful per-table reading, not grep.
- The detailed district STP inventory tables in the MPRs DO list more plants (e.g. Magadi 3.7 MLD,
  2022) but as district context, not PRS-stretch ULBs - a future "basin context" enrichment if wanted.
- **Nov-2025 MPR** (MPR_Nov2025.txt; user-supplied) is a STATE-WIDE STP-inventory annexure format,
  not a per-river narrative. Two takeaways: (1) CORRECTED the V-Valley STP - it lists 150 MLD
  operational treating 150.36 MLD & complying, so the earlier "~70 MLD (Feb 2026)" was a misread of
  a *December-2021 commissioning* bullet in the Feb-2026 log; current = ~150 MLD. (2) DATA-RELIABILITY
  FLAG: this state STP annexure lists Ramanagara/Kanakapura/Magadi STPs as *Complying* (with
  implausible utilisation jumps, e.g. Kanakapura 3.8 -> 6.29 MLD in 5 months), whereas every
  dedicated per-stretch PRS report 2021-2025 says *Non-complying (0 complying)*. We keep the
  per-stretch PRS reading (more authoritative for the stretch); the state inventory looks templated/
  optimistic. Lesson: NMCG MPR tables are inconsistent report-to-report - prefer the dedicated
  per-PRS narrative over the consolidated state annexures, and read "current vs historical-log" lines
  carefully.

## Panel UX = the partner's narrative arc (2026-06-29)

Restructured the PRS panel to the PDF page-1 flow: **(1) Context** - conclusion + MPR-overview line +
2020-vs-2025 comparison + priority (CPCB I / KSPCB IV divergence); **(2) Evidence of pollution** - a
promoted section (was a buried subtab) leading "documented over time, beyond BOD" with the CPCB BOD 72,
NWMP monthly (52 d/s Kanakapura), ATREE heavy metals, Paani lab analyses + "show evidence layer";
**(3) Per-area status** - tabs across the full stressor axis: Sewage, Industrial effluent, Solid
waste, Hazardous waste, FSTP, E-flow, Treated-water reuse, Flood plain. The old single "PRS" tab was
dissolved (context -> header, evidence -> promoted, E-flow/Flood -> own tabs). Single-topic narrative
tabs hide the subtab pill row. Density adds: plastic + biomedical as `otherStreams` on the Solid
units (Ramanagara 2.5/0.21, Kanakapura 1.28/0.007 TPD); hazardous/FSTP/e-flow/reuse/floodplain wired
from the MPRs. Caveat: per-stretch waste/effluent detail is clean only for 2023-June2025 (2021/2022/
Feb2026 report state-wide aggregates).

## Grievance reporting (record-first, deferred)

The PRS panel's "Report illegal sewage / effluent discharge" button is a labelled external link to
the NMCG online grievance module for now. That portal is write-only (no public tracking/status), so
the plan (decided 2026-06-29) is for NV to become the system of record: the button will open the
citizen-sightings capture pre-tagged `illegal-discharge` and pre-located to the stretch, with
assisted (not auto) portal submission + reference-number/status tracking + per-stretch aggregates.
Auto-forwarding is partnership-gated (no portal API). Full design in the citizen-sightings spec §15.
Nothing fragile ships in this PR.

## Explicitly deferred

- New themes needing fresh extraction: e-flow, flood plain, treated-water reuse, OCEMS live/not
  per 17-category unit, per-area F-register effluent quantity, Red/Orange/Green/White CETP detail.
- A dedicated 2020->2026 per-theme timeline UI (reusing gaps trend instead).
- Standalone `/basins/[basinId]/prs` route (atlas stays an embedded drill-down for now).
