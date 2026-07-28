# Sriperumbudur-Oragadam Corridor: Data Availability Report (Phase 0)

Status: RECON COMPLETE, awaiting review. No code, no repo data files yet.
Recon date: all probes and retrievals 2026-07-27 unless stated. Every claim below was verified by an actual fetch on that date; sample payloads are preserved in the session scratchpad (not committed).
Companion decision log: `docs/corridors/sriperumbudur/DECISIONS.md`.

Ranks used: **machine-readable** (scripted pull verified) / **PDF-extractable** (text-layer PDF verified) / **manual** (OCR, transcription, or interactive-only) / **unavailable** (no known public source; hedged, not absolute).

---

## 0. Executive summary

**Milestone 1 is fully supported, at better granularity than planned.** The headline map can be a firka-level (sub-taluk) classification choropleth drawn from CGWB's own assessment-unit polygons, with taluk and district roll-ups, a three-edition trend table on stable units, park boundaries at cadastral fidelity, and a corridor-specific regulatory explainer. Nothing in Milestone 1 requires interpolation, digitization, or estimation.

The recon also produced four findings that reshape the page's story. Credibility requires the page to say all four:

1. **The regulator's own current data does not class the corridor's host units as stressed.** In the 2025 assessment (portal year 2024-2025), Sriperumbudur taluk is Safe at a 24.5% stage of extraction; all five of its firkas are Safe. The stress sits in a ring around the corridor: Avadi taluk semi-critical 83.2%, Chengalpattu 78.8%, Thirukkalukundram 76.3%, and critical or over-exploited firkas hide inside Safe taluks (Walajabad and Uthiramerur). One clean trend story exists: Tiruttani slipped Safe to Semi-Critical in the 2025 edition. The 2016-17 firka assessment showed 11 over-exploited firkas in undivided Kancheepuram, so the longer arc is improvement on the regulator's books; the methodology must present that honestly rather than assume a depletion narrative.
2. **The permission regime is a state executive-order scheme, not CGWA.** Since TN repealed its groundwater act in 2013, industrial extraction NOCs outside the Chennai 1987 Act's scheduled villages are issued by the TN WRD's State Ground and Surface Water Resources Data Centre under G.O.s (G.O. Ms. 51/2004, G.O. Ms. 142/2014), enforced via TNPCB consent linkage. CGWA has issued zero NOCs in TN (its own list; the Rajya Sabha Q 2971 annexure has no TN row) and has no notified areas here. The 2022 CMA expansion moved the planning boundary over Sriperumbudur taluk but the 1987 Groundwater Act's reach is defined by its own village Schedule, which was not extended. The "what the rules require" explainer must be TN-specific, with CGWA's 2020 guidelines presented as the national frame whose applicability in TN is contested on paper and inoperative in practice.
3. **No public register of extraction permissions exists anywhere in the chain.** NOCAP is dead, its successor BhuNeer has no public search, SGSWRDC and CMWSSB publish no license lists. The nearest public mirror is TNPCB's OCMMS granted-consent search (works without login, corridor DEE offices enumerated), but consent orders record permitted effluent discharge, not water intake. This gap is first-class page content.
4. **The SIPCOT parks are documented as surface-water supplied.** SIPCOT's own EC compliance reports and EIA summaries state supply from CMWSSB (Chembarambakkam) plus TTRO reuse water, with at least Pillaipakkam's EC prohibiting groundwater draw. Park-level statements vary and must be cited per park, never generalized.

**Recommended cut for Milestone 1:** ship (a) firka+taluk classification map, (b) all-blocks data table with three-edition trend, (c) what-changed summary, (d) methodology, (e) TN-specific rules explainer, (f) park boundary overlay. Defer: well time series (M2), allottee/consent layers (M3), tank layer (pending TNGIS license confirmation), NAQUIM aquifer sections (M2 methodology context).

---

## 1. Corridor definition (decision required)

Per review amendment, two boundaries, both renderable today:

- **Statutory parks boundary**: SIPCOT Sriperumbudur, Oragadam DTA + SEZ + Medical Devices Park, Irungattukottai (+ Apparel Park), Vallam Vadagal I/II + Aerospace Park, Pillaipakkam (+ EMC), Mambakkam, plus private Mahindra World City. All available as cadastral-grade polygons from the SIPCOT GIS (section 5). One Hub Chennai has no known public boundary and is excluded from V1 (named as a gap).
- **Functional corridor boundary**: the assessment units containing those parks. Proposal: the 8 taluks whose firkas intersect park polygons plus their immediate ring, concretely Sriperumbudur, Kundrathur, Walajabad, Kancheepuram (Kancheepuram district), Chengalpattu, Tambaram, Vandalur, Thirupporur (Chengalpattu district), Avadi, Poonamallee (Tiruvallur district). Exact list to be fixed by a spatial intersect during the build and logged in DECISIONS.md.

## 2. Regulatory regime (recon track A, the material amendment)

Full citations and confidence labels are in the track report; key established facts:

| Question | Finding | Anchor citations (all retrieved 2026-07-27) |
|---|---|---|
| TN's own law | 2003 Act repealed by Act 23 of 2013 (in force 14 Sep 2013), nothing enacted since; draft bill submitted Jan 2020, never passed (probable) | India Code repeal act PDF; BW Legal World (403-blocked, secondary) |
| What operates instead | SGSWRDC NOC under G.O. Ms. 51 PWD 11.02.2004 (GEC categories gate scheme approvals) and G.O. Ms. 142 PWD 23.07.2014 (commercial extraction NOC, upheld by Madras HC Oct 2018); live e-District service WRD-101, Rs 6,000/well, 40-day window | wrd.tn.gov.in services page; CAG Report 9 of 2021 Ch. 3; archived SGSWRDC G.O. page |
| Chennai 1987 Act | In force; licensing by CMWSSB (city) and Collectors/RDOs (scheduled villages); reach is its own Schedule (243 or 302 villages, count unresolved), NOT the CMA boundary; s.17-A notification required to extend; none found after the 2022 CMA expansion | PRS act text; CMWSSB page; Citizen Matters Apr 2025 |
| CMA expansion | G.O. Ms. 184 H&UD 21.10.2022 expanded CMA to 5,904 sq km including Sriperumbudur taluk; planning boundary only | DT Next; CMDA G.O. archive |
| CGWA in TN | No NOCs ever issued in TN (RS Session 259 UQ 2971 annexure, 31,746 NOCs 2017-2023, no TN row); TN absent from CGWA notified-areas list; CGWA site lists TN as self-regulating "through Govt. Orders" | sansad.in AU2971.pdf; cgwa.mowr.gov.in; CGWB regulation page |
| Unresolved tension | S.O. 3289(E) 24.09.2020 claims pan-India applicability and supremacy over inconsistent state guidelines; never tested against TN; flag as contested, do not resolve | Gazette text (MPCB mirror) |
| CGWA tier obligations (national frame, quotable) | Para 4.1: no new non-MSME NOCs in over-exploited units; para 4.1(iii): annual audits above 100 m3/day plus 20% reduction over 3 years; para 5: tiered abstraction/restoration charges; paras 9/14: telemetry and piezometers by slab; amended by S.O. 1509(E) 29.03.2023 (S.O. number probable, gazette not yet fetched) | Gazette S.O. 3289(E) full text saved |

**Explainer design consequence:** two-panel rules section. Panel 1: what actually governs a corridor plant today (SGSWRDC NOC, TNPCB consent linkage, 1987 Act only if inside scheduled villages). Panel 2: the CGWA 2020 tier table as the national framework auditors work with, labeled with its contested status in TN. Open items: consolidated 1987 Act Schedule; G.O. 142 full text; S.O. 1509(E) gazette copy.

## 3. Dynamic groundwater assessment (dataset 1) - machine-readable + PDF-extractable

**The unit story (both discontinuities now empirically mapped):**

- TN assesses at **revenue firka** level in every state edition (1,166 firkas through 2022; 1,202 in the 2024 and 2025 editions). From the 2023 cycle the national compilation apportions firkas to **taluks** (313 TN units). The IN-GRES portal serves the taluk series for portal years 2022-2023, 2023-2024, 2024-2025 (editions 2023, 2024, 2025) and the firka series for portal years 2019-2020 and 2021-2022 (editions 2020, 2022). Portal year 2016-2017 (edition 2017) is firka-level on pre-split districts; Chengalpattu returns zero rows before 2019-20. Nothing below edition 2017 is served at unit level.
- **Trend rule (proposed, D3):** taluk trend arrows across editions 2023, 2024, 2025 only (identical units, verified). Firka history 2020/2022 shown as context. No arrows across the 2022 to 2023 unit change or the 2019 district split.

**Access paths, all verified 2026-07-27:**

1. **IN-GRES open API** (`POST /api/gec/getBusinessDataForUserOpen`, solved payload in project memory). Pulled: TN state roll (39 rows), all three districts, all editions above. Per-unit records carry category, stage %, recharge breakdown, extraction by use, availability, trend slope, quality tagging, and a `reportSummary` giving **per-firka category (keyed by firka uuid) even in the taluk-era editions**. District uuids: Kancheepuram `92e1051a-c7cb-4ebc-8722-97e3e8f0ecb2`, Chengalpattu `70f2da31-929b-4977-8610-da37d3a3be73`, Tiruvallur `2e628024-3969-42fc-bdbc-dc426c63176e`.
2. **IN-GRES open GeoServer** (`https://ingres.iith.ac.in/geoserver/ows`, WFS 2.0.0, no auth): layer `gec:indgec_vers_tamilnadu`, 4,743 firka polygons in four vintages (year attr 2019/2021/2022/2025), 112 firkas in the corridor bbox for year=2025. **Verified join rule:** the API's `reportSummary` firka uuids match the **year=2022** polygon vintage exactly (5/5 in the Sriperumbudur taluk test); year=2025 features carry re-versioned uuids. Join latest categories to the 2022 vintage by uuid; re-verify statewide at build time (D2).
3. **State report PDFs** (firka-level stage % + category annexures): 2025 edition (Nov 2025, 130 pp + Annexures, 386/1,202 firkas OE statewide), 2024 edition (Feb 2025, 392/1,202 OE), 2022 edition (Wayback only). 2023 edition: summary + scanned TN G.O. only; use national taluk annexure. Also national "Block wise Categorization" compact PDFs for editions 2017-2025, and TN G.O. 113 (2011 firka categorization, Wayback). Direct URLs in the CGWB track report; note the CGWB warehouse `/download/<id>` route truncates files, use the static `/public/uploads/documents/` path.
4. Direct firka/taluk API drilldown below district level returns zero rows (retested); the firka detail comes from `reportSummary` + polygons + state PDF annexures.

**Verified corridor numbers (edition 2025 = portal 2024-2025):** Sriperumbudur Safe 24.5% (was 21.0 in 2023 ed.), Kundrathur Safe 27.9, Walajabad Safe 55.2 (one Critical firka inside), Kancheepuram Safe 51.0 (one Semi-Critical firka), Uthiramerur Safe 69.9 (one OE + one Critical + one Semi-Critical firka), Chengalpattu Semi-Critical 78.8, Thirukkalukundram Semi-Critical 76.3, Avadi Semi-Critical 83.2, Tiruttani Safe-to-Semi-Critical 70.3, Tiruvallur Safe 56.2, Poonamallee Safe 67.9. Tiruvallur district carries a `salinity` class firka (Minjur belt): not assessed on extraction, must render as its own class, never as a stage %.

**Cross-checks to run at build:** IN-GRES taluk values vs national compilation annexures; firka categories vs 2025 state PDF Annexure rows (Sriperumbudur, Sunguvarchatiram, Walajabad, Kundrathur rows confirmed present). Conflicts, if any, shown per the both-sources rule.

License: GoI/state publication, cited with attribution (matches existing `ingres-gw-assessment-tn` registry entry). IN-GRES GeoServer has no stated terms; same posture as the API.

## 4. Groundwater level monitoring wells (dataset 2) - machine-readable, live

- **India-WRIS dataset API** (contract in project memory): district spellings pinned as `Kancheepuram`, `Chengalpattu`, `Tiruvallur`, agency `CGWB`. Pulled 2015-01-01 to 2026-07-27: **223 stations, ~336,800 readings** (Kancheepuram 110 stations/143k, Tiruvallur 105/179k, Chengalpattu 8/14.7k), 95% telemetric. **Network is alive: latest readings 2026-06-04, 83 stations reporting in 2026** (contrast Delhi's network, dead since Sep 2025). Sriperumbudur tehsil alone has 11 stations.
- **Trap (D5):** WRIS's district field is pre-split for many stations (the Kancheepuram query returns tehsils now in Chengalpattu; the Chengalpattu query returns only 8 stations). Assign stations to districts/firkas by coordinates, never by the district field. Per-station sign-convention derivation per the platform's standing method; no abs().
- **CGWB Ground Water Year Book TN 2024-25** (verified PDF, 128 pp): Annexure I has manual well readings for May/Aug/Nov 2024 + Jan 2025 including corridor wells; district tables partly use pre-2019 boundaries. PDF-extractable; joins to WRIS by name+location.
- **SGSWRDC monthly "Average Ground Water Level Status"** series 2011 to Sep 2023 (~130 PDFs, Wayback; site currently unreachable, TLS expired; say "currently unreachable" not defunct). District-level only. Station-level SGSWRDC data is sold via eChallan: manual/priced, skip.

## 5. SIPCOT parks and Parivesh (dataset 4 + amendment 3) - machine-readable

**Decisive find: SIPCOT GIS WFS**, `https://sipcotgis.tn.gov.in:8086/geoserver/cite/wfs` (GeoServer, no auth, 1,747 feature types, GeoJSON/KML/SHP out). Per park: outer boundary (`industrial_complex_boundary-<ParkKey>`), per-plot polygons **with allottee company names** (`plot_boundary-*`), buildings, water bodies, water lines, overhead tanks with capacities, sumps, drainage, roads. All target parks verified present with correct georeferencing and cadastral vertex density; park keys and plot counts in the track report (Oragadam DTA 227 plots, Irungattukottai 235, Vallam Phase1 271, Mahindra 181...). Caveats: polygon extent exceeds the `ind_cmplx_area_acre` attribute (mapped extent vs notified saleable area; use polygon for outline, never the attribute as polygon area); license is "All Rights Reserved" footer with no open-data grant (blocker posture, D4).

**Water declarations (PDF-extractable):** SIPCOT-hosted half-yearly EC compliance reports (text layer; e.g. Pillaipakkam EC22B039TN146946: 1 MGD from CMWSSB Chembarambakkam + TTRO, groundwater draw prohibited) and environmentclearance.nic.in EIA executive summaries (text layer; Vallam A/B: 2 MLD CMWSSB/TTRO; fetch with `curl -k`, TLS chain broken). EC letters on SIPCOT's site are shared scans, OCR-only. HUDCO 2021 volume confirms TTRO supply to Irungattukottai, Sriperumbudur, Oragadam from Koyambedu/Kodungaiyur 45 MLD plants. PARIVESH 2.0 itself is an SPA (needs headless browser; its OGD mirror on data.gov.in 403'd this session): defer, not needed for M1.

## 6. CGWA NOC register (dataset 5) - structurally empty; state mirror partial

Covered in section 2 findings. Usable artifacts: RS 259 UQ 2971 annexure (PDF + data.gov.in CSV mirror under GODL, CSV URL verified-existing but 403 mid-session, refetch), CAG Report 9 of 2021 Ch. 3 quotes, CGWA state-authorities page. **TNPCB OCMMS** granted-consent search: no login, POST per DEE office (Sriperumbudur 100476, MMNagar 100477, Tiruvallur 100475, plus Ambattur, Gummidipoondi), returns industry name/dates/consent type + anonymously downloadable consent-order PDFs stating max effluent KLD. Measured 2025 CTO grants: Sriperumbudur DEE 765, MMNagar 669, Tiruvallur 350. Label strictly as discharge-side pollution consents. M3 material, not M1.

## 7. Rainfall (dataset 6) - machine-readable

IMD 0.25-degree cells covering the corridor core: (12.75, 79.75), (12.75, 80.0), (13.0, 79.75), (13.0, 80.0); existing `generate_imd_rainfall.py` pipeline extends with a corridor entry. NASA POWER verified live at a corridor point; Open-Meteo provisional-fill pattern applies unchanged. IN-GRES per-unit records also carry the assessment's own rainfall_mm (Sriperumbudur 2025: 1,223.9 mm), citable as the assessment input.

## 8. Tanks and water bodies (dataset 7) - machine-readable, license-gated

TNGIS WFS (endpoint healthy): `generic_viewer:all_tanks` 4,465 and `all_water_bodies` 6,988 features in the corridor bbox; water_bodies carries LGD village codes (name attributes often null; geometry is the value). Chembarambakkam's full existing repo cohort (rich-body satellite stack, HydroBASINS catchment, daily storage) anchors the surface-water story. First Census of Water Bodies rows for the 3 districts are one filter change on the existing state-wide ingest. **License: M1 blocker resolved into a posture, not a green light (D4):** TNGIS publishes no operative terms (Terms modal is literally lorem ipsum); TN Data Policy 2022 s.3.2 and NGP 2022 point open-by-intent. Ship only with per-dataset provenance note + separate data-license note, and send the confirmation email to tngis.support@tn.gov.in before the tank layer renders. If unconfirmed by M1, the tank layer waits; assessment geometry does not depend on it (IN-GRES polygons are CGWB's own).

## 9. Administrative boundaries (dataset 8) - machine-readable

- **Assessment-unit polygons: IN-GRES `gec:indgec_vers_tamilnadu`** (section 3). The only firka geometry anywhere; CGWB's own.
- **Taluk frame: TNGIS `generic_viewer:taluk_boundary`** - post-2019 correct (22 corridor taluks verified incl. Vandalur, Kundrathur, Avadi, Pallavaram), Tamil names, LGD codes. Blocks (`block_boundary`), revenue villages (`revenue_villages`, 1,531 in bbox), village panchayats also present.
- Fallbacks ranked down: geoBoundaries ADM2 is pre-split (no Chengalpattu) and ODbL share-alike; ADM3 has post-2019 taluks but inconsistent attribution; LGD is the authoritative code roster (no geometry, free crosswalk via TNGIS LGD fields); SoI free downloads behind registration; Datameet pre-split; Bhuvan vectors 403.
- No CMA-boundary layer found in open workspaces (CUMTA boundary exists, wider than CMA). The 1987 Act schedule question (section 2) cannot be drawn from any found layer yet.

## 10. Secondary literature (dataset 9) + extras

12-item annotated bibliography in the track report. Strongest: Packialakshmi/Ambujam/Nelliyat 2011 (peri-urban groundwater markets, this exact belt), Janakarajan/MIDS corpus (open PDFs), Harishankar & Vedamuthu 2019 (peri-urban tank breakdown, CC BY), Krishnan & Saravanan 2022 (Kancheepuram GW quality, open), the 2016 Oragadam GIS quality study, L. Elango's Anna University group (deepest relevant corpus; collaborator candidate), TERI+Mahindra 2021 CMA water assessment, CNBC 2019 (Kancheepuram GW fell >6 ft in the crisis year, 3x state average). CGWB 2007 district brochures (Kancheepuram, Tiruvallur; none post-split for Chengalpattu) and NAQUIM reports (Chennai Aquifer 2017: 109 firkas, 38 OE then; Palar 2019) are PDF-extractable aquifer context for M2.

**Extras:** District Environment Plans exist for Kancheepuram (2019, scanned, hidden behind a dead page + live CDN PDF) and Tiruvallur (2019, text PDF); none for Chengalpattu. The TN DEP template has **no borewell-permission section at all**, another instance of the untraceable-permissions finding. DEP consented-industry counts (undivided Kancheepuram 4,534; Tiruvallur 2,132, both 2019) are the stock anchors for OCMMS flow data.

## 11. Licensing summary

| Source | Terms found | Posture |
|---|---|---|
| IN-GRES API + GeoServer | none stated; GoI assessment data | cite with attribution (existing registry precedent) |
| India-WRIS dataset API | GoI open portal | cite with attribution |
| CGWB / CAG / gazette / sansad PDFs | GoI publication | cite with attribution; quote with source |
| TNGIS WFS | no operative terms (lorem ipsum); TN Data Policy 2022 open-by-intent | confirmation email + separate data-license note before shipping vectors (D4) |
| SIPCOT GIS WFS | "All Rights Reserved" footer, no data terms | same posture as TNGIS: written reuse request; boundaries are strong public-interest use, allottee plot layer held for M3 pending reply (D4) |
| TNPCB OCMMS | government records, no license | cite per-document URLs; scrape respectfully; M3 |
| data.gov.in CSV mirrors | GODL-India | clean |
| OSM (fallback only) | ODbL | avoid mixing into IN-GRES/TNGIS layers |
| Literature | per-paper (CC BY, CC BY-NC, paywalled) | cite; no redistribution of paywalled PDFs |

## 12. What Milestone 1 includes (recommendation)

**In:** firka classification choropleth (edition 2025, IN-GRES polygons + reportSummary categories, cross-checked against the state PDF annexure), taluk stage % labels and roll-up, three-edition taluk trend table with arrows (2023/2024/2025), what-changed prose (Tiruttani slip, Uthiramerur/Madhurantakam recoveries, the OE-firkas-inside-safe-taluks caveat), SIPCOT park outlines + Mahindra World City overlay (outline only), the TN-specific rules explainer with the CGWA tier table as flagged national context, methodology + full source index, named gaps (no permission register, no Chengalpattu brochure/DEP, One Hub boundary, salinity-class units).
**Out of M1:** well time series (M2; data verified live), tank layer (pending TNGIS confirmation), allottee names and OCMMS consent counts (M3; verified feasible), NAQUIM aquifer cross-sections (M2), any Parivesh-derived layer, any interpolation (none needed).
**Open questions for review:** (1) functional-corridor taluk list sign-off; (2) whether the firka choropleth is the headline or the taluk view is (recommend firka headline, taluk toggle); (3) whether to show the 2016-17 pre-split firka history as a context panel or hold for M2; (4) the two license-confirmation emails (TNGIS, SIPCOT) go out under your name or the project's.

---

## Addendum, 2026-07-28 (post-M1 review)

The firka stage % question raised in review is resolved in this record's favour: the state report annexure does carry firka-level stage of extraction (confirmed by extraction; corridor firkas range 6.17% to 125.94% in the 2025 edition). The wrong statement was the live page's named-gap entry, which has been corrected. M1 now extracts the 47 corridor firka stages from the annexure (`scripts/extract_corridor_firka_stages.py`), surfaces them in the map tooltips and table, and enforces annexure-vs-API category agreement per firka at build time. Residual, stated as a gap on the page: firka stages exist in one publication only, so those percentages have no independent cross-check. See DECISIONS.md D13-D14.
