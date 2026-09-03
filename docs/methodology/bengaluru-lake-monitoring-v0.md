# Satellite Monitoring of Bengaluru's Lakes: Methodology Note

**neer-vazhvu lake water-quality monitoring, v0 (partner draft)**
**Status: draft for discussion with the remote-sensing partner; nothing in this note is live**
**Base reference: partner deck "Monitoring Inland Water Pollution in Bengaluru" (42 slides, last revised 14 Aug 2026)**
**Date: 3 Sep 2026**

## Abstract

This note sets out how a Sentinel-2-based lake monitoring layer for Bengaluru should be built so that its numbers survive a regulator's scrutiny, refresh themselves, and connect to the decisions AMRUT 2.0 and the Greater Bengaluru Authority (GBA) actually take. It takes the partner deck as the base reference: the deck demonstrates four band-ratio indicators and three weighted composites on ten lakes for one season, and proposes them as decision support under the AMRUT 2.0 rejuvenation framework. We keep that framing and extend it in five directions: a processing chain that first classifies what the sensor is looking at (open water, algae, floating vegetation, froth, exposed bed) before computing any index; a KPI catalogue of roughly fifty indicators grouped by what they measure and what decision they support, each with its resolution, cadence, tier, threshold basis and known failure modes; a calibration protocol that separates relative (Tier 1) from calibrated (Tier 2) numbers and names the in-situ data each needs; an alerting design built on each lake's own nine-year baseline rather than literature thresholds; and the cause and governance layers (sewage infrastructure, cascade topology, custodian, programme state) without which an index has no address to send a work order to. Section 2 lists the items in the deck that need resolving before any of its numbers are reused. Section 13 lays out a phased pilot and a division of work. Section 16 gives the error bound and confidence rule for every KPI and shows which bounds move with satellite resolution and which do not.

## 1. Purpose and audience

The audience is the partner's remote-sensing team and, once agreed, the GBA lake wing, KSPCB, and consultants preparing AMRUT 2.0 detailed project reports. The note is written to be handed over: every KPI states where it comes from, at what resolution, how often, with what accuracy ceiling, and what it is for. It is also the specification we would build to, so it names what already exists on the platform and what is new.

Three questions organise it:

1. What did the deck establish, and what must change before its outputs can be trusted?
2. What can be measured from open satellite data about a Bengaluru lake, honestly, at which lake sizes?
3. What turns a measurement into something a custodian acts on?

## 2. Base reference: the partner deck

### 2.1 What the deck does

| Element | Deck's approach |
|---|---|
| Sensor and period | Sentinel-2, median composite of April to May 2026 scenes; full-year 2025 series at 5-day resolution for ten lakes with "targeted imputation" |
| Lake set | Ten named lakes: Jakkur, Yelahanka, Agara, Begur, Bellandur, Byrasandra, Hulimavu, Ulsoor, Varthur, Sankey |
| Boundaries | OpenCity lake layer (ATREE-CSEI, Nov 2025); GBA ward layer (Dec 2025, post-delimitation) |
| Indicators | CDOM proxy (B4/B2), NDCI (B5-B4)/(B5+B4), NDTI stated as (B3-B4)/(B3+B4), TSS proxy (B4/B8) |
| Composites | High Nutrient Concentration Index (CDOM, NDCI, inverse TSS at a third each); Inorganic Turbidity Index (TSS, NDTI, inverse NDCI at a third each); Algal Bloom Index (NDCI and TSS at half each) |
| Scoring | Low, Moderate, High per lake per indicator; lakes mapped to AMRUT 2.0 intervention codes (A3 aeration, B2 desilting, C1 and C2 planting, D1 to D2.4 treatment measures) |
| Validation | Correlation with KSPCB dissolved oxygen and TSS described as "along expected lines"; pre- and post-monsoon boxplots; within-season coefficient of variation; within-month traces for Jakkur and Varthur |
| Framing | AMRUT 2.0 situation-assessment checklist; merits and limitations slide; recommendation to pair satellite with ground testing |

### 2.2 Items to resolve before any number is reused

These are listed so the partner can check them; several are one-line fixes.

1. **NDTI sign.** The deck's formula slide gives NDTI as (B3-B4)/(B3+B4). The published index (Lacaux et al. 2007) is (Red-Green)/(Red+Green), i.e. (B4-B3)/(B4+B3), and the deck's own threshold table (high risk above 0.301) assumes that convention. With the formula as written, turbid water scores negative and the turbidity ranking inverts. Either the formula or the thresholds must change; the maps and the table on slide 20 need recomputing after the fix.
2. **TSS thresholds.** The TSS proxy B4/B8 is a ratio of two positive reflectances and cannot be negative. The threshold block for TSS (minus 1.000 to plus 1.000) is the NDTI block repeated, so no stated TSS band applies to the stated TSS formula.
3. **CDOM units.** The CDOM proxy is a dimensionless band ratio, but the thresholds are given in absorption units, aCDOM(440) in per metre. Those units need a calibrated inversion; a raw ratio cannot be compared to them.
4. **Composite arithmetic.** No normalisation is described before averaging indicators with different ranges. The Algal Bloom Index averages a bounded index (NDCI) with an unbounded ratio (TSS proxy); the annexure boxplots show it running from 0.5 to 1.75 on no interpretable scale. Section 9 proposes rule-based verdicts instead.
5. **Validation is asserted, not shown.** No correlation coefficient, sample size, station identity or scatter plot appears. KSPCB's monthly Bengaluru sheet (130 lakes and 36 columns in June 2026) does carry turbidity and TSS, so a TSS comparison is reproducible in principle; chlorophyll-a is absent from it, and a DO-versus-bloom-index correlation is indirect by construction because DO has no optical signature. Station, date window, n and the coefficient need stating. Section 10 sets out what a reproducible validation needs.
6. **Bellandur reads Low on NDCI.** Across 437 Sentinel-2 scenes since 2017, Bellandur's surface is on average 74% algae or floating macrophyte, 12% open water, 12% exposed bed and 2% froth (our composition classifier, section 3). An index computed over the whole polygon is sampled mostly on vegetation, not water, which is the likely reason the most eutrophic lake in the set scores Low on a chlorophyll index. The independent record agrees: Bareuther, Klinge and Buerkert 2020 classified 62 one-metre images of Bellandur and Varthur from 2002 to 2019 and found macrophytes at 58-59% of the surface on average and 81-82% by 2019, with open water averaging 8% on Bellandur. Every optical index has to be gated to open-water pixels first (section 7).
7. **Imputation.** The full-year 2025 charts are labelled "targeted imputation", which means values were interpolated across cloud gaps. Interpolated points must be visibly distinguished from observations, or omitted. Section 11 uses observed passes only and reports coverage.
8. **Monsoon coverage.** The deck promises updates every 5 days. June to September over Bengaluru is heavily clouded; optical chemistry is largely blind in those months. The deck's own claim that lakes worsen in the monsoon from runoff is therefore the season it can least observe. Sentinel-1 covers extent, not chemistry, in that window.
9. **Small lakes.** The ten lakes chosen are among the largest. Most of the 183 GBA water bodies are under 20 ha; section 5 states what is feasible per size class rather than extrapolating from the ten.
10. **Boundary provenance.** The OpenCity ATREE-CSEI lake layer is published under CC BY (last updated 26 February 2026), which permits reuse with attribution, but its page does not record how the boundaries were derived (survey sheet, satellite tracing, or both). It can serve as a mapped boundary, not as the legal anchor, until that is documented.

### 2.3 What the deck gets right, and we keep

- The AMRUT 2.0 situation-assessment framing and the indicator-to-intervention-code mapping. This is the right shape for a verdict: a lake state that points at a coded measure.
- The honest merits and limitations slide, and the recommendation that satellite screening directs, rather than replaces, ground testing.
- The within-month variability argument: monthly grab samples miss most of what a 2- to 3-day optical cadence sees.
- Using the post-delimitation GBA wards and the GBA lake count.

## 3. What already exists on the platform (baseline, do not rebuild)

| Capability | Where | Status | Relevance here |
|---|---|---|---|
| Rich-body deep-zoom pages | 14 Bengaluru bodies including Agara, Bellandur, Hebbal, Hesaraghatta, Jakkur, Madivala, Puttenahalli, Rachenahalli, Sankey, Ulsoor, Varthur, Yelahanka | Live | Seven of the deck's ten lakes already have a page, imagery timeline, JRC and Dynamic World water trend, built-up trend, building footprints |
| Lake surface-area anomaly | Sentinel-2 NDWI against JRC 20-year monthly baseline | Live (Chennai, Madurai); Bengaluru wiring pending | Hydrology KPIs H1 to H3 |
| Cascade topology | 1,033 nodes, 1,053 edges, 43 river outlets for the Bengaluru district; catchment area, upstream area received, buildings and rooftop area per lake | Live | Network KPIs N1 to N4; inlet locations for sub-zones |
| Pollution profile, Tier 1 | Branch `bellandur-pollution-profile`: per-pass surface-composition classifier (froth, algae, open water, bed), NDCI and NDTI on a 10 m-inset open-water core, named inlet and weir sub-zones, Landsat surface-temperature anomalies, froth-event frequency, frontend panel | Built, not merged | The processing chain in section 7 is this pipeline generalised |
| Tier-2 calibration engine | `calibrate_rich_body_pollution.py`: ordinary least squares of index against date-matched in-situ samples, promotion gate n at least 10 and R2 at least 0.5, in-situ CSV contract | Built, waiting for data | Section 10 |
| Citizen sightings | PWA capture with a "water surface condition" category designed to corroborate the satellite layer | Built on branch, infra not provisioned | Ground truth for surface-state KPIs |
| National restoration register | Indicator catalogue C1 to C10, S1 to S6, T1 to T5, U1 to U3, K1 to K6 with Wetland Health Card bands A to E; 1,671 records in the 2026 Q3 run | Draft PR | KPI ids and bands here reuse that scheme where they coincide |
| Data freshness registry and alerts | Headwaters | Live | Cadence and staleness reporting, section 11 |
| Ground and administrative sources already located | KSPCB NWMP lake sheets; BBMP Lake Management System API (182 lakes with custody); KSPCB F-register of consented industries; BCAP sewage and STP baselines; BWSSB STP list | Documented | Cause and governance KPIs |
| Satellite capability scan | `docs/research/satellite-capabilities-scan-2026-07.md` | Done | Method choices and accuracy ceilings cited below |

The composition classifier changed the design of the pollution layer once already: the naive design (indices over the whole polygon) would have produced near-empty output on Bellandur. That lesson applies directly to the deck.

## 4. Design principles

1. **Classify before you index.** Decide per pixel whether the sensor is seeing open water, algae, floating vegetation, froth or bed; compute water-quality indices on open water only; report the class fractions as first-class KPIs.
2. **Two tiers, always labelled.** Tier 1 is relative: an index, a fraction, a percentile against the lake's own history. Tier 2 is calibrated: a physical unit with a stated error, promoted only when matched in-situ data pass a published gate. Nothing in Tier 1 is written as a concentration.
3. **Observed passes only.** No imputation. Coverage is itself a KPI, and a lake with no clear scene in 30 days says so.
4. **Own baseline before literature thresholds.** The 2017 to 2026 archive gives every lake a seasonal normal. Anomalies are measured against that first; literature thresholds are a second, labelled, opinion.
5. **Minimum evidence gates.** Every KPI has a pixel-count and scene-count floor below which it reads "insufficient", never a number.
6. **Resolution honesty.** Bands B5 (red edge) and B11 (SWIR) are 20 m native. NDCI and MNDWI are 20 m products sampled at 10 m; say so wherever they appear.
7. **Methods as data.** Thresholds, formulas, atmospheric-correction choice, calibration coefficients and their provenance are published alongside the numbers and versioned.
8. **Infrastructure, not a scorecard.** Outputs are monitoring the custodian owns. Lakes are not ranked against each other in public; language never reads as blame.
9. **Gaps are first-class.** DO, BOD, COD, coliform, heavy metals and pathogens have no optical signature. They appear in the catalogue as declared gaps with the ground source that covers them.
10. **One shared pipeline.** A new lake is a configuration entry, not new code. The same chain runs for Chennai, Hyderabad and every other city on the platform.

## 5. Scope: which lakes, at what depth

### 5.1 The universe

| Set | Count | Source | Note |
|---|---|---|---|
| Water bodies by custodian (KTCDA custody lists, four PDFs, obtained 3 September 2026) | BBMP list: 201 serials, of which 4 are marked "Out of BBMP" (Bangalore North Additional taluk), so 197 inside BBMP limits; BDA 5 (Bellandur, Varthur, Ramasandra, Kommaghatta, Chikkabanavara); Forest Department 4 (Madivala, Puttenahalli, Hebbal, Nagavara); BMRCL 1 (Veerasandra). Total 211 rows, 207 inside the city. Other counts in circulation: 183 "live lakes" (BBMP Lakes department); 182 (GBA, June 2026); 187 (Minor Irrigation Minister, October 2025) | KTCDA lists; BBMP; GBA statements | The deck's "183 of 188" is not reproducible from these lists (BBMP plus BDA is 202 here); its Forest and BMRCL counts match. Use the KTCDA list as the custody join (V1) and state which count a figure refers to |
| BBMP Lake Management System | 182 lakes with custody | lms.bbmpgov.in API | Coordinate errors exist; validate before join |
| KSPCB lake monitoring | 147 NWMP (MINARS) lake and tank stations in Bengaluru Urban and Rural districts in the 2025-26 classification; 130 lakes in the monthly Bengaluru sheet (June 2026); 93 of 182 GBA lakes sampled in April 2026 | KSPCB water-quality page; OpenCity mirror | The deck's 147 is the station count; the monthly sheet is the join target |
| District cascade layer | 1,025 water bodies, 778 named | OSM polygons, terrain-routed | Covers the wider district, not only GBA |

### 5.2 Size classes and what is feasible

Pixel counts are for a 10 m grid before shoreline masking; the one-pixel shoreline ring removes a large share of pixels from small bodies.

| Size class | Bodies in the district layer | Pixels at 10 m | What is credible |
|---|---|---|---|
| 50 ha and above | 51 | 5,000 or more | Everything: per-pixel maps, sub-zones, hotspot persistence, phenology, thermal sub-zone anomalies (indicative) |
| 20 to 50 ha | 108 | 2,000 to 5,000 | Per-pixel maps and fraction-affected; sub-zones if inlets are mapped; thermal at lake level only |
| 5 to 20 ha | 404 | 500 to 2,000 | Lake-level per-pass indices on the open-water core, composition fractions, extent, phenology; no reliable within-lake structure |
| 2 to 5 ha | 305 | 200 to 500 | Composition fractions, extent and hydroperiod; optical indices only when the open-water core clears the pixel floor |
| Under 2 ha | 157 | Under 200 | Categorical only: wet or dry by season, built over, footprint intact (the register's K1 to K6); optical quality unassessed at open resolution |

Bellandur (316 ha in the cascade layer) is about 31,600 pixels; Varthur 154 ha; Yelahanka 96 ha; Jakkur about 50 ha. The deck's ten lakes all sit in the top two classes.

### 5.3 Depth ladder

| Tier | Lakes | Cadence | Products |
|---|---|---|---|
| Screen | All bodies 2 ha and above (about 870 in the district layer; all 183 GBA bodies) | Every clear pass; monthly roll-up | Composition fractions, extent, own-baseline anomaly flags, coverage |
| Monitor | Bodies with an open-water core of 5 ha or more | Every clear pass | Full optical KPI set, phenology, hotspot maps, alerts |
| Deep | Rich bodies (currently 14) and any lake under an NGT order or a live DPR | Every clear pass plus annual sub-metre read on demand | Sub-zones, thermal, deep-zoom imagery, sub-metre boundary and inlet evidence, governance join |

## 6. Data and access

### 6.1 Sensors and derived datasets

| Dataset | Resolution | Cadence | Used for | Licence |
|---|---|---|---|---|
| Sentinel-2 L2A (S2A, S2B, S2C) | 10 m (B2, B3, B4, B8), 20 m (B5, B6, B7, B8A, B11, B12) | See 6.2 | All optical KPIs | Free and open (Copernicus) |
| Sentinel-1 C-band SAR (S1C, S1D from mid-2026) | 10 m GRD | 6-day repeat | Monsoon water extent; floating-vegetation cross-check | Free and open |
| Landsat 8 and 9 Collection 2 Level 2 | 30 m optical, 100 m thermal (ST_B10) | 8 days combined | Lake surface temperature; long baselines to 1984 via Landsat 5 and 7 | Free (USGS) |
| Dynamic World V1 | 10 m, per Sentinel-2 scene | Per scene | Water and built classes; catchment built-up trend (already computed per rich body) | CC BY 4.0 |
| JRC Global Surface Water v1.5 | 30 m | Monthly and yearly, 1984 to 2024 | Observed maximum extent for the fixed footprint; long-run occurrence | Free |
| Google satellite embeddings (AlphaEarth) annual | 10 m | Yearly | Change-detection screen on footprints and buffers (Ennore precedent) | Google Earth Engine terms; see 6.4 |
| Open Buildings 2.5D Temporal, Overture footprints | Building level | Annual, quarterly | Structures inside footprint and buffer | Open |
| GHSL GHS-BUILT-S R2023A, ESA WorldCover 2021 | 10 m | Epochs | Catchment imperviousness | Open |

Commercial and ISRO imagery (PlanetScope 3 m, Cartosat-3 0.45 m distributed product, LISS-IV 5.8 m) are not part of the monitoring chain. They are the on-demand sharp layer for boundary evidence, small-body identification and event forensics, priced per use (section 13).

### 6.2 Revisit over Bengaluru: measured, not nominal

We queried the Copernicus Data Space catalogue for Level-2A products on MGRS tile 43PGQ, which covers the city, for 1 Sep 2025 to 31 Aug 2026:

| Measure | Value |
|---|---|
| Products | 180 |
| Distinct acquisition dates | 161 |
| By satellite | S2C 73, S2B 75, S2A 32 |
| Gap between acquisitions | median 2 days, mean 2.26 days (1 day: 16; 2 days: 87; 3 days: 56; 4 days: 1) |

The tile sits in the overlap of two relative orbits (R019 and R062), so the textbook 5-day revisit understates Bengaluru: two-satellite operation alone gives a 2- to 3-day cadence here, and S2A's extension campaign (prolonged to 31 Dec 2026) adds roughly one pass in eleven days. Cloud-free frequency in June to September is far lower; no Bengaluru-specific published figure exists, and the doc reports the observed clear-scene count per lake per month rather than assuming one.

### 6.3 Ground and administrative data

| Source | What it carries | Cadence | Use | Known limits |
|---|---|---|---|---|
| KSPCB monthly Bengaluru lake sheet and NWMP classification | 36 columns per lake in June 2026: temperature, DO, pH, EC, BOD, COD, nitrate, nitrite, ammoniacal and Kjeldahl nitrogen, phosphate, faecal and total coliform, turbidity, TSS, TDS, major ions, and the designated-best-use class | Monthly PDF; OpenCity mirror from July 2023 (public domain); data.gov.in catalogue | G1, G2; turbidity and TSS are calibration candidates for Q3, Q4 and Q8 (section 10) | Chlorophyll-a is absent although the CPCB guideline asks for it on lakes; PDF tables need extraction; station coordinates are not published |
| AMRUT 2.0 DPR monitoring (Advisory on Urban Waterbody Rejuvenation, Appendix A.1) | Water quality pre-project once, bi-monthly during works, quarterly after, including transparency, TSS, chlorophyll-a, nutrients, coliforms; sediment quality; inlet and outlet samples | Per DPR | The match-up source that every funded rejuvenation creates; G5 | Only where a DPR is live; sampling dates are not aligned to satellite passes unless asked |
| BWSSB real-time STP dashboard | 21 stations at STP and tertiary outlets (Bellandur Amanikere 90 MLD, K and C Valley 60 MLD among them): inlet and outlet flow, BOD, COD, TSS, nutrients, DO | Continuous, public | S1, S3 (treated-effluent outfalls into lakes) | STP outlets only; nothing on a lake |
| Citizen test series | PNLIT monthly tests at Puttenahalli since June 2016; Lake Health Index (FFEM kits: nitrate, phosphate, turbidity) on Ulsoor, Doddabommasandra, Shivapura; Mira kits (nitrate, phosphate, chlorophyll, DO) distributed to lake groups in 2019 | Irregular | G4, G5 candidates; the only citizen chlorophyll channel found | Methods and detection limits vary; needs a data-sharing agreement per group |
| CGWB and Karnataka Groundwater Directorate | Nitrate above 45 mg per litre across much of Bengaluru South and Anekal (CGWB district booklet); state annual quality reports; IISc borewell sampling near Bellandur and Varthur | Annual | Stakes indicator S7 | District-level 2024-25 figures not extracted; portal certificate errors |
| BBMP Lake Management System | 182 lakes: id, name, coordinates, zone, custody | Static with updates | Custodian join (V1) | Per-lake pages unstable; coordinate typos |
| KTCDA lake list and buffer rules | Lake register; 2025 amendment sets buffers by size: 3 m (1 acre or less), 6 m (1 to 10), 12 m (10 to 25), 24 m (25 to 100), 30 m (over 100 acres) | Per amendment | Boundary KPIs B1 to B3 use the size-appropriate buffer | Buffer depends on notification date |
| BWSSB and BCAP baselines | 1,440 MLD sewage generated vs 1,372.5 MLD installed STP capacity (BCAP full report, 2024); STP list and capacities | Annual | Cause KPIs S1 to S3 | STP-wise inflow and outflow not public; OCEMS public feed absent |
| KSPCB F-register | Consented industries per regional office with colour category | 2019 scan | Cause KPI S4 | OCR-approximate; dated |
| OpenCity ATREE-CSEI lake boundaries | Lake polygons | Nov 2025 | Candidate legal or survey boundary for the fixed footprint | Licence to confirm |
| GBA wards (post-delimitation) | Ward polygons | Dec 2025 | Reporting unit | |
| Cascade layer | Inlets and outlets by topology; upstream and downstream lakes | Versioned | Sub-zone placement; network KPIs | Terrain-inferred edges carry a confidence class |
| Citizen sightings | Geotagged photo, category, date | Continuous | Surface-state corroboration; froth and dumping events | Not yet provisioned |

### 6.4 Compute and licensing

Google Earth Engine's free tier excludes fee-for-service deliverables and, for government agencies, "repeated production of data products" and "tooling for management, policy, or web applications". An operational lake service for a municipal client is commercial use under those terms. The existing pipeline runs on GEE under the noncommercial tier, which is acceptable for the proof of concept and for the partner's research use, not for a paid or GBA-facing service.

The archive is available as cloud-optimised GeoTIFFs outside GEE: Element 84's Earth Search on AWS (`sentinel-2-l2a`, global from December 2018, STAC API), the Copernicus Data Space Ecosystem (native products via STAC, OData and S3; Sentinel Hub APIs with a free tier), and Microsoft Planetary Computer's STAC catalogue. Reading lake windows only, the whole GBA set is a few tens of square kilometres of pixels per pass; per-pass processing is minutes on a laptop or a small VM, and a year of 10 m index chips for all lakes is a few gigabytes. ACOLITE and C2RCC run locally on CPU. The Ennore embedding-drift screen depends on a GEE-only dataset and stays a research-tier tool.

Decision for section 14: build the operational chain on CDSE or AWS COGs from the start, keep GEE for the research spine and the register proof of concept.

## 7. Processing chain

The chain below is the existing Bellandur pipeline generalised, with the atmospheric-correction and water-mask steps upgraded for Tier 2.

### 7.1 Scene selection and masking

- Every Level-2A scene intersecting a lake's fixed footprint is a candidate; no pre-filter on scene-level cloud percentage, because a clear lake in a cloudy scene is still an observation.
- Per-pixel cloud and shadow mask: Cloud Score+ (`cs_cdf` at 0.60 or above) on GEE; s2cloudless plus a shadow projection on the COG chain. The Scene Classification Layer alone is not used over water; it misclassifies dark water and bright scum.
- Sun-glint screen: scenes where the open-water core's NIR (B8) median exceeds a per-lake percentile of its own history are flagged glint-affected and excluded from index KPIs, kept for extent. For Tier 2 the glint is removed rather than screened, with the SWIR-based method of Harmel et al. 2018 (the GRS processor: per-pixel glint from B11 and B12 on the assumption of zero water-leaving radiance in the SWIR, extrapolated to the visible by the Fresnel ratio; on 150 AERONET-OC match-ups it raised the all-band R2 from 0.56 to 0.87 and cut the discrepancy by 60%, best at 490, 560 and 665 nm, and it needs an aerosol optical thickness input from AERONET or CAMS). Sentinel-2 views near nadir, so glint is expected on low-latitude scenes around the solstices.
- A pass is "clear" for a lake when the clear-pixel share of the fixed footprint is 70% or more; between 30% and 70% it contributes composition fractions and extent only; below 30% it is discarded for that lake. Both thresholds are published parameters.

### 7.2 Atmospheric correction by tier

| Tier | Correction | Why |
|---|---|---|
| Tier 1, relative | Sen2Cor Level-2A as distributed | Consistent across the whole archive and both processing chains; adequate for within-lake and within-history comparisons |
| Tier 2, calibrated | ACOLITE dark-spectrum fitting as default; C2RCC or the GRS chain (Tavares et al. 2025) as alternatives, chosen per lake and recorded | Sen2Cor is land-tuned; over turbid inland water it biases the blue and red bands that the physical inversions depend on. The capability scan's standing rule: ACOLITE-DSF default, C2RCC valid alternative, document the choice |

Tier 2 outputs are computed from the aquatic correction only; Tier 1 indices are never re-labelled as Tier 2 by applying a coefficient to Sen2Cor reflectance.

The intercomparison behind these choices (Warren et al. 2019; six processors, 1,059 to 1,668 match-ups, 13 inland water bodies) carries three findings that shape the chain. First, Polymer and C2RCC had the lowest errors overall, but Sen2Cor and iCOR performed better on inland lakes than on the coast, and the two aquatic processors' errors at 560 nm rose 25-55% on inland water, attributed to land adjacency (half of the inland match-ups were within 500 m of shore). Second, every processor's absolute errors exceeded 100% in the red and 1,000% in the near-infrared on inland water. Third, no processor reproduced the 704/665 nm red-edge to red ratio on corrected reflectance (R2 below 0.01 for all six, absolute differences 72-225% for the best four). The red-edge indices Q1 and Q2 are therefore computed on one consistent Level-2A or top-of-atmosphere product and used as relative Tier 1 quantities, which is also what the largest Sentinel-2 chlorophyll validation found to work best (Coffer and Schaeffer 2024, MCI on top-of-atmosphere reflectance). Physical retrievals in Tier 2 (Q4, Q6, Q8) use the water-specific processors on the red and green bands where their errors are smallest.

### 7.3 Fixed footprint, water mask, open-water core

- **Fixed footprint** = legal or survey boundary where one exists, otherwise the OSM polygon, unioned with the JRC observed maximum extent. A moving OSM polygon is never the denominator, or encroachment reads zero after a mapper redraws it.
- **Shoreline ring**: the outer 10 m of the footprint is excluded from all optical KPIs (adjacency and mixed pixels). For lakes over 50 ha the ring is 20 m.
- **Per-pass water mask**: MNDWI (B3, B11) above 0 on the footprint minus ring, with an NDVI ceiling so floating vegetation is not counted as water. MNDWI-family and AWEI indices are preferred over NDWI because their thresholds are stable across scenes (overall accuracy above 0.95 against 0.5 m reference water, against 0.88 for NDWI with an unstable threshold; Herndon et al. 2020, Landsat over Sahelian ponds). Where a sensor lacks SWIR (PlanetScope), the mask falls back to NDWI and the H1 confidence class drops one step.
- **Open-water core** = footprint inset 10 m, intersected with the per-pass open-water class from the composition step. Every water-quality index is sampled here and nowhere else.

### 7.4 Surface-composition classifier

Applied per pixel, per clear pass, with precedence froth, then algae or floating vegetation, then open water, then bed:

| Class | Rule (reflectance 0 to 1) | Note |
|---|---|---|
| Froth | mean(B3, B4, B8) above 0.18 and B11 above 0.10 and NDVI below 0.10 | Bright, spectrally flat, not vegetation; a lower bound at 10 m |
| Algae or floating vegetation | NDVI above 0.25 on non-froth pixels | Hyacinth mats and dense scum; separated from open-water bloom (Q1) by class |
| Open water | MNDWI above 0 and not the above | The only class indices are computed on |
| Bed | Remainder inside the footprint | Exposed lakebed, dry margin |

Thresholds are initial values tuned on Bellandur using the diagnose (percentile dump) and validate (per-scene table around known froth dates) modes of the existing script. Each new lake runs the same two modes before its series is trusted; hyacinth-dominated lakes may need a second NDVI threshold to split mats from scum, and the Floating Algae Index (section 8.1) is the candidate discriminator.

### 7.5 Index computation and resolution

All indices are computed from reflectance after the masks above. Formulas are in Appendix A. B5 and B11 are resampled from 20 m; NDCI, MCI, FAI and MNDWI are therefore 20 m products and are labelled as such on every chart and map. Ten-metre products are those using only B2, B3, B4 and B8: NDTI, the red-band turbidity proxy, NDVI, NDWI and the CDOM band ratio.

### 7.6 Zones

Each lake has three zone types, all self-describing GeoJSON:

- **Lakebed**: the fixed footprint; denominator for composition fractions and extent.
- **Open-water core**: derived per pass; the index zone.
- **Named sub-zones**: inlets, outflow weir, and any feature of interest, as small polygons (about 100 to 150 m across) placed from the cascade layer's edge endpoints and drain mapping. Sub-zones report the same KPIs plus their anomaly against the lake interior, which is the source-attribution signal (section 8.3, P3 and P4).

### 7.7 Aggregation

- The unit of record is one lake, one clear pass. Time series are per-pass series.
- Monthly and seasonal roll-ups are medians of observed passes with the count shown. A month with fewer than two clear passes is shown as a gap.
- Maps are per-pass or temporal medians over a stated window with the scene count in the legend. The deck's April to May composite is one such map; it is a valid product when its n is on it.
- Nothing is interpolated.

### 7.8 Minimum-evidence gates

| Product | Floor |
|---|---|
| Composition fraction for a zone | 20 valid pixels |
| Optical index on the open-water core | 10 open-water pixels in the core (as in the existing script); 100 for a per-pixel map |
| Sub-zone anomaly | 10 valid pixels in the sub-zone and a computable lake-interior value the same pass |
| Seasonal statistic | 4 clear passes in the season |
| Own-baseline anomaly | 3 prior years with a computable same-season statistic |
| Thermal sub-zone anomaly | Always labelled indicative: 100 m thermal pixels against 120 m sub-zones |

Below a floor the KPI reads "insufficient" with the reason, never a value. Section 16 gives the error model behind these floors and the confidence rules that sit above them.

## 8. KPI catalogue

Conventions used in every table:

- **Tier** 1 = relative (index, fraction, percentile against the lake's own history); 2 = calibrated physical unit with stated error; R = research-grade, not for the served product yet.
- **Bands** follow the Wetland Health Card convention where the register already uses it (A best to E worst, I insufficient). Where a literature threshold exists it is named with its source; it is a labelled second opinion after the lake's own baseline (P7).
- **Status**: Live (on the platform today), Built (on the unmerged pollution branch), New (this note), Gap (declared, not measurable from the sensor).
- Optical indices are computed on the open-water core only (section 7.3). Resolution is the native resolution of the coarsest band used.
- Ids in brackets are the corresponding register indicators (C, S, T, U, K series) where one exists.

### 8.1 Surface state (W): what the sensor is looking at

The composition fractions are the first thing reported for every lake and every pass, because they decide whether the water-quality indices below mean anything. On Bellandur they are the headline.

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| W1 | Open-water fraction | Share of the fixed footprint classified open water this pass | S2 L2A, 20 m (MNDWI), every clear pass | 1 | Own baseline; representative index requires W1 above 25% or 10 core pixels | Whether Q-series indices are representative; dry-down (H5) | Built |
| W2 | Algae and floating-vegetation fraction [C4] | Share of footprint with NDVI above 0.25 on non-froth pixels | S2, 10 m, every clear pass | 1 | Health Card macrophyte bands: A under 10%, B 10-20, C 20-30, D 30-40, E over 40. Reference series for validation: Bareuther et al. 2020 give per-date macrophyte, algae and open-water shares for Bellandur and Varthur on 31 dates each, 2002-2019, from 1 m imagery (no formal accuracy assessment in that study) | De-weeding scheduling; whether aeration or planting measures apply | Built |
| W3 | Macrophyte versus scum split | Within W2, floating mats (hyacinth) versus surface scum, using the Floating Algae Index (Hu 2009; S2 form B8 minus the B4-B11 baseline) and NDVI magnitude; Sentinel-1 dual-pol corroboration in the monsoon (Simpson et al. 2022, Vembanad) | S2 20 m; S1 10 m; every clear pass | 1 | Thresholds tuned per lake with the diagnose and validate runs; FAI above 0.08 on TOA reflectance is the grey-literature scum flag | Distinguishes a de-weeding problem from an eutrophication problem; both look green | New |
| W4 | Froth fraction and events [C8] | Share of footprint, and of the outflow sub-zone, in the froth class; an event is a pass with froth above 5% at the outflow | S2, 10 m, every clear pass; events per year | 1 | Register C8: A 0, B 1-2, C 3-5, D 6-9, E 10 or more events per year; a lower bound at 10 m | Surfactant load timing (Das et al. 2023: pre-monsoon inflow pulses release sediment-sorbed surfactants); public-safety response at weirs | Built (Bellandur: 31 events 2017-2026, clustered February to April) |
| W5 | Exposed-bed fraction | Remainder class inside the footprint; reported at the dry-season minimum | S2, 10 m, every clear pass | 1 | Own baseline | Desilting window and access (AMRUT B2) | Built |
| W6 | De-weeding effectiveness | W2 in the month before a dated removal, the month after, and at 3, 6 and 12 months; regrowth rate | Derived from W2; per dated work | 1 | Reference: Lake Tana audit found cover back to about 18% above pre-removal within a year | Contract verification; whether removal without inflow control is worth repeating | New |

### 8.2 Optical water quality (Q): the deck's indicators, corrected and extended

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| Q1 | Chlorophyll-a proxy, NDCI [C5] | (B5 minus B4)/(B5 plus B4) on the open-water core (Mishra and Mishra 2012) | S2, 20 m, every clear pass | 1; 2 after calibration | Own-baseline percentile first. Literature (Mishra Table 6, MERIS-derived, indicative on S2): NDCI below minus 0.1 under 7.5 mg per m3; 0 to 0.1 about 16-25; 0.1 to 0.2 about 25-33; 0.2 to 0.4 about 33-50; above 0.5 surface scum. WHO 2021 alert levels for chl-a with cyanobacterial dominance: 12 and 24 micrograms per litre (drinking and recreational Alert Level 2) | Eutrophication state; aeration, recirculation, constructed and floating wetlands (AMRUT A3, A5, D2.1 to D2.4). Computed on one consistent reflectance product, never across processors: no atmospheric-correction processor reproduces the 705/665 ratio on inland water (Warren et al. 2019, section 7.2) | Built (Tier 1) |
| Q2 | Chlorophyll-a proxy, MCI | Maximum Chlorophyll Index on B4, B5, B6: the 705 nm peak height above the 665-740 nm baseline | S2, 20 m, every clear pass | 1; 2 after calibration | Coffer and Schaeffer et al. 2024 (103 US lakes, 300 match-ups): MCI on top-of-atmosphere reflectance beat NDCI on every product; 82% accuracy on eutrophic versus not; chl-a = 3586 MCI + 6.27; detection limit about 10 micrograms per litre; mineral sediment inflates it (filter on baseline slope) | Cross-check to Q1; more stable where atmospheric correction yields negative reflectance | New |
| Q3 | Turbidity proxy, NDTI | (B4 minus B3)/(B4 plus B3) on the core (Lacaux et al. 2007; red minus green, higher is more turbid) | S2, 10 m, every clear pass | 1 | Own baseline. Qualitative index; no published physical calibration | Sediment and inflow signal; inlet attribution with P3 | Built |
| Q4 | Turbidity, physical | Single-band algorithm T = A rho_w / (1 minus rho_w / C) in FNU. Nechad, Ruddick and Neukermans 2009 tabulate A at 2.5 nm steps: 282.95 at 665 nm, 354.20 at 705 nm, 2,059 at 860 nm (C is taken from the companion 2010 SPM paper and is not printed in the 2009 one). Dogliotti et al. 2015 red/NIR switching: A = 228.1, C = 0.1641 at 645 nm; A = 3,078.9, C = 0.2112 at 859 nm; red alone below rho_w(645) of 0.05, NIR alone above 0.07, linear blend between; on aquatic-corrected reflectance | S2 with ACOLITE, C2RCC or GRS, 10 m, every clear pass | 2 | Dogliotti: mean relative error 13.7%, bias 4.8%, n = 106 across five coastal and estuarine sites, valid 1 to 1,000 FNU, saturating above; Nechad 2009: relative error 30-35% below 708 nm on the validation set, best at 708 nm (RMSE about 5 FNU). Neither paper gives a rule for shifting the coefficients to Sentinel-2's 665 and 833/865 nm band centres; both were calibrated on coastal water. Dogliotti's sensitivity analysis matters for Bengaluru: phytoplankton absorption at 645 nm introduces errors of 19% and 57% at chlorophyll-a of 10 and 30 mg per m3, so the red band is unreliable in bloom conditions and the NIR branch (above about 15 FNU) is the one to trust on eutrophic lakes | Sediment removal design (B2), inlet treatment (D2.3) | New |
| Q5 | CDOM proxy | Green over red ratio B3/B4 on the core (Toming et al. 2016: R2 0.72 against CDOM on Estonian lakes; Al-Kharusi et al. 2020) | S2, 10 m, every clear pass | 1 | Own baseline. Absolute aCDOM(440) only via a global inversion, Tier 2: the Pahlevan et al. 2022 Mixture Density Network reaches a median symmetric accuracy of 34.5% on held-out in-situ spectra for Sentinel-2 bands, 55-91% in leave-one-source-out tests, and 80-107% on Landsat satellite match-ups; the authors recommend local retraining | Organic load and sewage-inflow signal; replaces the deck's B4/B2 whose thresholds were in absorption units | New |
| Q6 | Water clarity, Secchi depth | Semi-analytical Secchi from Kd (Lee et al. 2015) on C2RCC or ACOLITE reflectance; Soomets et al. 2020 report R2 0.97, RMSE 0.36 m on Baltic lakes | S2, 20 m, every clear pass | 2 | WHO recreational framework: vigilance at Secchi 1-2 m, Alert Level 1 at 0.5-1 m (with visible greenish turbidity) | The one satellite KPI a lake group can verify with a disc; recreational advisories | New |
| Q7 | Apparent colour, hue angle and Forel-Ule class | CIE hue angle from B2, B3, B4 (and B5) with the MSI tristimulus weights and fifth-order correction polynomial of van der Woerd and Wernand 2018 (their Tables 1 and 2; the 10 m and 20 m band sets are given as basic results, only the 60 m set was validated); Forel-Ule index 1 to 21 via the Novoa et al. 2013 bounds | S2, 10 m, every clear pass | 1 | Robust to atmospheric-correction choice; field standard deviation 4-5 degrees for MSI and OLI against hyperspectral truth (603 spectra, coastal and inland); FUI trophic bands quoted in follow-on work: 1-6 oligotrophic, 7-10 mesotrophic, 11 and above eutrophic (secondary) | Public-facing colour KPI a citizen can check against the water; long series back through Landsat | New |
| Q8 | Suspended matter, physical | Nechad et al. 2010 single-band SPM (665 nm A = 355.85, C = 0.1728; 705 nm A = 493.65, C = 0.1879, as transcribed in ACOLITE; the 2010 paper itself is still to be read) or the Pahlevan et al. 2022 MDN (Sentinel-2 hold-out median symmetric accuracy 32.1%, satellite match-ups 73-81% on Landsat) | S2 aquatic-corrected, 10 m, every clear pass | 2 | mg per litre with the algorithm's stated error; local recalibration when TSS match-ups exist | The deck's "TSS" done in units | New |
| Q9 | Trophic State Index | Carlson 1977 from calibrated chl-a, TSI = 9.81 ln(chl) + 30.6, or from Secchi, TSI = 60 minus 14.41 ln(SD). A direct route exists: Li et al. 2023 fitted a modified Carlson TSI (weights 0.54 chlorophyll, 0.297 Secchi, 0.163 phosphorus) straight to Sentinel-2 C2RCC reflectance on 45 Chinese lakes (431 samples): single band ratios such as 665/705 reach R2 0.59-0.61 with RMSE 7.5-7.9 TSI points on validation, a gradient-boosted model R2 0.87 with RMSE 4.1; transfer to Indian sewage-fed lakes untested | Derived from Q1/Q2 (Tier 2) or Q6; or direct | 2 | Under 40 oligotrophic, 40-50 mesotrophic, 50-70 eutrophic, over 70 hypereutrophic (Li et al. use 30 and 50) | The single number a Health Card or DPR asks for; only after calibration | New |
| Q10 | Cyanobacteria | Not retrievable: the phycocyanin (620 nm) and 681 nm bands used by CI-cyano are absent from Sentinel-2 (Mishra et al. 2019). Blooms are reported as blooms of unknown taxon; dominance needs microscopy | | Gap | | Toxin risk decisions need a field sample; the KPI names the station to sample | Gap |

Accuracy ceiling to communicate for Tier 2, from the largest small-lake validation available (Tavares et al. 2025, 108 lakes from 3 ha, 600 samples): chlorophyll-a MAPE about 56%, turbidity about 47%, with no effect of lake size on error. Indian tropical urban recalibration is untested; those figures are an upper bound on what to promise.

### 8.3 Pattern and phenology (P): where in the lake, and when

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| P1 | Fraction of surface affected | Share of open-water core pixels above a threshold on Q1 or Q3 this pass (the CyAN "extent" metric) | Derived, every clear pass | 1 | Threshold = lake's own 75th percentile (default) or the Mishra 0.1 mark, both published | Robust alternative to the lake mean; the alert primitive for P5 | New |
| P2 | Hotspot persistence map | Per pixel, share of clear passes in a season on which the pixel exceeded the lake median by a published margin | S2, 10 m (20 m for Q1), seasonal; lakes 20 ha and above | 1 | Persistence above 60% marks a zone | Placement of aerators, floating and constructed wetlands, in-situ drain treatment | New |
| P3 | Sub-zone anomaly | Difference between a named sub-zone (inlet, weir) and the lake interior in composition fraction, Q1, Q3 and T2, with the share of passes on which the sign persists | Derived, every clear pass | 1 | Persistence above 60% with a margin above the interior's own spread | Candidate source for field verification, never a verdict of discharge | Built (Bellandur weir: froth plus 3.2 points, persistent on 82% of passes; inlet warmer by 1.3 C) |
| P4 | Inlet attribution flag | P3 at an inlet sub-zone combined with the upstream lake's state (N2) and the drain type (S3) | Derived, seasonal | 1 | Rule-based, section 9 | Which inlet to treat first (D2.3) | New |
| P5 | Bloom onset, duration, peak | Onset = first 10-day window with P1 at or above the published share; duration = days between first and last such window; peak = window of maximum P1 (definitions after Mishra et al. 2019 and Wang et al. 2025) | Derived, seasonal | 1 | Own baseline: onset earlier than the lake's median by more than 30 days flags | Pre-summer scheduling of aeration and inflow control; the "which lakes before summer" list | New |
| P6 | Bloom magnitude | Seasonal mean of per-pass maximum Q1 on the core, area-normalised (Mishra et al. 2019) | Derived, seasonal | 1 | Own baseline | Year-on-year comparison a Health Card can quote | New |
| P7 | Own-baseline anomaly | Percentile of the current value within the lake's same-season distribution over 2017 to the previous year, for Q1, Q3, Q5, W2, H1; requires 3 prior years | Derived, every clear pass | 1 | Above 90th percentile on two consecutive clear passes = anomaly; above 97th = severe | Every alert in section 11 | New |
| P8 | Within-season variability | Coefficient of variation of per-pass values within a season (the deck's metric, kept) | Derived, seasonal | 1 | Descriptive | Shows where monthly sampling under-observes | New |
| P9 | Monsoon lag | Cross-correlation of Q3 with cumulative rainfall (CHIRPS or IMD gridded); Caroni et al. 2025 found a consistent one-month lag on 42 Indian lakes | Derived, annual | R | Descriptive | Timing of post-monsoon desilting and first-flush controls | New |

### 8.4 Hydrology (H)

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| H1 | Water spread area | MNDWI water area inside the fixed footprint, per pass | S2, 20 m, every clear pass | 1 | Own baseline (JRC 20-year monthly for the anomaly level, as in the shipped pipeline) | Storage state; dry-down | Live (Chennai, Madurai); Bengaluru wiring pending |
| H2 | Share of full tank level [C1] | H1 over the notified FTL polygon where one exists, else over the observed maximum | Derived, every clear pass | 1 | Register C1: A 85% and above, B 70-85, C 50-70, D 30-50, E under 30 (same-season) | Storage restoration targets in a DPR | New |
| H3 | Hydroperiod [C2, K3] | Months wet per year, S2 in clear months, S1 in the monsoon | S2 plus S1, monthly | 1 | Register C2 bands against the 2017-2019 baseline | Which lakes are becoming seasonal | New |
| H4 | Monsoon extent (SAR) | Sentinel-1 VH backscatter threshold (Otsu) on the footprint, with an ERA5 wind screen and exclusion of W2 macrophyte pixels | S1 GRD, 10 m, 6-day | 1 | Own baseline | The only extent observation from June to September; flood-season storage | New (highest ready-now item in the capability scan) |
| H5 | Post-monsoon retention and dry-down | H2 at end-October versus February-March; consecutive passes with declining H1 below a share | Derived, seasonal | 1 | Own baseline | Recharge and seepage questions; whether a lake is losing water to a breach | New |
| H6 | Long-run occurrence | JRC Global Surface Water v1.5 monthly and yearly, 1984 to 2024 | Landsat, 30 m, annual | 1 | Reference; global products under-detect small turbid water bodies (false-negative rates 0.02 to 0.22 for JRC and the Landsat QA mask against 0.5 m reference, Herndon et al. 2020), so JRC sets the observed maximum for lakes above about 20 ha and is not the monthly record for smaller ones | Baseline and the observed maximum for the fixed footprint | Live |

### 8.5 Thermal (T)

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| T1 | Lake surface temperature | Landsat 8/9 Collection 2 surface temperature (ST_B10) on the footprint inset 100 m (Attiah et al. 2023) | Landsat, 100 m native, 8-day combined | 1 | Own baseline; published RMSD 1.7 to 3.7 C depending on method | Seasonal context for blooms and DO; lakes under 50 ha yield a handful of pure pixels | Built |
| T2 | Sub-zone thermal anomaly | Sub-zone minus interior temperature, per scene | Landsat, 100 m | 1 (indicative) | Always labelled indicative: one thermal pixel per sub-zone | Warm-inflow signal for P3 | Built |
| T3 | Stratification-risk flag | Season, T1 and low wind (ERA5) combined; no direct satellite proxy for stratification in small shallow lakes exists in the literature, and a 10:30 overpass cannot see the diurnal cycle | Derived, monthly | R | Rule-based, labelled as risk not state | Aeration scheduling in the pre-monsoon; declared as research-grade | New (R) |

### 8.6 Boundary and catchment (B)

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| B1 | Built fraction inside the fixed footprint [C3] | Dynamic World built and bare fraction inside the footprint minus a 30 m bund ring; structure count from Open Buildings 2.5D and Overture | 10 m, annual; structures quarterly | 1 | Health Card "area converted": A 0-1%, B 1-5, C 5-10, D 10-20, E over 20 | Encroachment removal and survey priorities | Live (built trend per rich body) |
| B2 | Built change inside the statutory buffer | Same, inside the KTCDA size-dependent buffer (3, 6, 12, 24 or 30 m by lake size after the 2025 amendment) and inside a fixed 300 m analytical halo for comparability with Sourav et al. 2024 | 10 m, annual | 1 | Own baseline; the halo is context, the statutory buffer is the finding | Buffer enforcement; the BBMP survey reported about 80% of surveyed lakes with some encroachment (SANDRP citing Deccan Herald, February 2026). Precedent at one site: IISc ENVIS Technical Report 134 (December 2017) read Google Earth time series against 1904 cadastral maps for the Agara-Bellandur wetland and found the connecting rajakaluves narrowed from 45 m to 20 m and from 60 m to 28.5 m, cross-sections down 23-57% between 2000 and 2015, and wetland encroachment rising from 63.9 acres in 2007 to 74.3 acres in 2015, with urban fill in the Bellandur-Varthur valley zone rising from 1.4% of the area in 2002 to 74.3% in 2016 | New |
| B3 | Structures in footprint and buffer | Count and footprint area of building polygons | Overture, quarterly | 1 | Descriptive | Evidence list for a survey team | Live (rich bodies) |
| B4 | Catchment pressure | Impervious share of the routed catchment (GHSL 10 m) and its trend (Dynamic World); buildings and rooftop area already carried per lake in the cascade layer | 10 m, annual | 1 | Reference: Li et al. 2020 found basin impervious share correlated with total phosphorus (r 0.76) in a Chinese lake; no Indian regression exists, and Bengaluru's nutrient load is attributed to sewage rather than stormwater | Which lakes' loads will keep rising regardless of in-lake works | Live (cascade properties) |
| B5 | Change screen (embeddings) | Annual satellite-embedding drift on footprint and buffer, as run for Ennore | 10 m, annual | R | Uncalibrated thresholds; rank order only | Where to point a sub-metre read | Built (Ennore) |
| B6 | Sub-metre boundary read | Structured reading of a Cartosat-3 (0.45 m distributed) or Pleiades scene against the fixed footprint: fill, structures, bund cuts, inlet condition | On demand, annual | 2 | Present, absent, uncertain, with geometry | Legal-grade boundary and inlet evidence | New (register protocol exists) |

### 8.7 Network (N): the lake as a node

| Id | KPI | Definition and method | Source, resolution, cadence | Tier | Bands or thresholds (basis) | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| N1 | Cascade position and upstream load | Position in the chain, number of upstream lakes, catchment area received | Cascade layer, versioned | 1 | Descriptive | Where in the valley the lake sits; Bellandur is position 7 with 4 inflows | Live |
| N2 | Upstream state | Worst P7 anomaly among directly upstream lakes this month | Derived, monthly | 1 | Rule | Inlet attribution (P4); intervening upstream first | New |
| N3 | Downstream risk flag | Set on lakes directly downstream of a lake in bloom or froth state | Derived, monthly | 1 | Rule | Early notice to the next custodian | New |
| N4 | Hydraulic connectivity [T3] | Share of feeder channels and outlets choked or built over, from cascade edges plus the sub-metre read; channel width against the cadastral width where a revenue map exists (ETR 134's method) | Annual | 2 | Health Card inlet-outlet ratio: A under 0.2 to E over 0.8 | Channel restoration before in-lake works; ETR 134 shows the Agara-Bellandur channels at half their mapped width | New |

### 8.8 Cause (S): the pipe, not just the lake

| Id | KPI | Definition and method | Source, cadence | Tier | Basis | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| S1 | Sewer-shed treatment balance | Installed STP capacity versus estimated sewage generation in the valley draining to the lake. Citywide figures vary by source and year and are cited with both: 1,440 MLD generated with about 780 MLD untreated (CAG 2021, period to 2017-18); 1,372.5 MLD installed against 1,440 MLD generated (BWSSB); 1,480 MLD generated, 1,348.5 MLD installed, 1,212.7 MLD treated (Economic Survey of Karnataka 2025-26 as reported March 2026). CAG 2021 also recorded 89 lakes directly connected to stormwater drains and lake STPs at only 8 lakes. Decentralised plants are part of the balance: in Yelahanka, of 325 decentralised STPs approved by KSPCB only 174 had been built and about 60% of wastewater reached the stormwater system (WELL Labs 2024, cited in Bergman et al. 2026) | BWSSB, CAG, BCAP; annual | 1 | Descriptive | Whether an in-lake measure can hold without an upstream STP or diversion | New |
| S2 | Sewage share of inflow | Reference values where studied: 62% of downstream inflow across 44 cascading lakes in the Hebbal-Nagavara valley, 95% in dry years (Kulranjan and Srinivasan 2026) | Literature; per study | 1 | Descriptive | Frames every nutrient KPI: the load is sewage | New |
| S3 | Inlets by type | Count and location of inlets; stormwater drain versus sewer versus treated-effluent outfall. Bellandur reference: three inlets (Agaram, ST bed, HAL) carrying at least 400 MLD, Agaram about 128 MLD and ST bed about 102 MLD of sewage, into a lake of about 367 ha with a 279 km2 catchment (ETR 134, 2017) | Cascade edges, OSM, BWSSB; annual | 1 | Descriptive | Sub-zone placement; in-situ drain treatment targets | New |
| S4 | Consented industries in the catchment | Count by colour category (Red, Orange, Green, White) from the KSPCB F-register | 2019 scan; per edition | 1 | Descriptive | Industrial contribution context; F-register extraction already built | Documented |
| S5 | Continuous effluent monitoring coverage | STPs and industrial units on continuous monitoring whose outfall reaches the lake. BWSSB publishes 21 real-time STP outlet stations; CPCB's OCEMS portal is login-only; KSPCB's January 2026 resolution requires OCEMS on every STP outlet above 100 KLD in the metropolitan region, streamed to KSPCB and CPCB, with no public-disclosure clause | BWSSB dashboard; KSPCB, CPCB | 1 for BWSSB, Gap for OCEMS | Descriptive | Whether the treated-effluent inflow (S3) is what it claims to be | Documented |
| S6 | Nutrient load reference | Literature loads where they exist (Ramachandra et al. 2017: about 45 t nitrogen and 20 t phosphorus per day entering Bellandur; TN 60-90 mg per litre) | Literature | 1 | Descriptive | Sizes the treatment measure; constructed wetlands alone cannot absorb that load | New |
| S7 | Groundwater at the rim [S3] | Nitrate and coliform at the nearest CGWB or state well, and the IN-GRES category of the assessment unit | CGWB, Groundwater Directorate; annual | 1 | IS 10500 limit for nitrate, 45 mg per litre | The health stake behind a polluted lake: Bengaluru's borewells recharge from these lakes | New |

### 8.9 Ground truth and calibration (G)

| Id | KPI | Definition and method | Source, cadence | Tier | Basis | Decision it supports | Status |
|---|---|---|---|---|---|---|---|
| G1 | Monitoring station join | Nearest KSPCB NWMP station, its parameters, last sample date, distance to the open-water core | KSPCB monthly reports | 1 | Descriptive | Whether the lake has any ground record, and how stale | New |
| G2 | Regulator's water class | The CPCB designated-best-use class as reported by KSPCB for the lake's station: A (drinking without conventional treatment: DO 6 or more, BOD 2 or less, total coliform 50 or less MPN per 100 ml), B (bathing: DO 5, BOD 3, coliform 500), C (drinking after treatment: DO 4, BOD 3, coliform 5,000), D (wildlife and fisheries: DO 4, free ammonia 1.2 mg per litre), E (irrigation and industrial cooling). KSPCB's April 2025 to February 2026 classification put no Bengaluru lake in A, B or C in any month; June 2026 sheet: 68 D, 62 E, Bellandur E with DO 2.6 and BOD 32 mg per litre | KSPCB monthly | 1 | The regulator's own criteria, shown as its finding | The official state of the lake; never recomputed by us | New |
| G3 | Calibration status per index | For Q1, Q3, Q4, Q5, Q8: number of match-ups, R2, RMSE, promotion decision, date | Calibration engine, per run | 1 | Gate: n at least 10 and R2 at least 0.5 (existing engine) | Whether a Tier 2 number may be shown | Built |
| G4 | Citizen corroboration | Count of moderated "water surface condition" sightings in the last 90 days and their agreement with W2 to W4 | Sightings, continuous | 1 | Descriptive | Ground truth for surface state; froth and dumping the sensor misses | Built (branch) |
| G5 | Field match-ups | Secchi, turbidity and chlorophyll-a samples taken within one day of a clear pass at points inside the open-water core; sources in order: KSPCB monthly turbidity and TSS, AMRUT DPR monitoring where a project is live, lake-group series (PNLIT, Lake Health Index, Mira kits), IISc historical series, and a designed campaign | Field campaign, per campaign | 2 | Section 10 | The data that unlocks Tier 2 | New |

### 8.10 Governance (V): who acts, what is already promised

A synthesis of 413 studies on Bengaluru's lakes (Bergman et al. 2026) finds the technological strand of that literature frames degradation "primarily as a data problem" with limited engagement with governance actors, and names governance fragmentation as one of four drivers alongside urbanisation, consumption and climate. The rows below are the reason this note does not stop at indicators.

| Id | KPI | Definition and method | Source, cadence | Basis | Decision it supports | Status |
|---|---|---|---|---|---|---|
| V1 | Custodian [T1] | Named custodian and zone (GBA corporation, Forest Department, BMRCL, BDA) | LMS, KTCDA list; per edition | Class | Where the work order goes | Documented |
| V2 | Programme state [T4] | None, proposed, DPR, works underway, completed (year), court-ordered | Restoration register, tenders, orders; quarterly | State | Need class (register section 7.2) | Live (register) |
| V3 | Works on record | Dated restoration works with type mapped to AMRUT codes | Restoration register; quarterly | List | Effectiveness (V5); avoiding duplicate spend | Live (register) |
| V4 | Orders in force | NGT and High Court orders and monitoring-committee directions that name the lake. For Bellandur, Varthur and Agara: NGT OA 125/2017 (order of 6 December 2018) set up the Justice N. Santosh Hegde monitoring committee, a Rs 500 crore escrow, and directed KSPCB with CPCB to install real-time water-quality monitoring on the three lakes and to monitor activities around them "by using drones and satellite imageries"; the 21 October 2019 order recorded no real-time system in place; the 12 March 2021 order moved oversight to the Chief Secretary with monthly review and quarterly reports to the Ministry of Jal Shakti and the National Wetlands Authority. Karnataka High Court WP 38401/2014 (1 August 2023) ordered a joint encroachment action plan for drains and lakes | Curated; per order | List | Reporting obligations the KPIs can serve; the NGT direction is a standing mandate for exactly this layer | New |
| V5 | Intervention effectiveness | KPI trend in the 12 months before versus after a dated work (W2 for de-weeding, H2 for desilting, Q1 and P5 for wetlands and aeration), with the lake's own seasonal normal removed. No published before-and-after series exists for a Bengaluru lake: Ramachandra, Sincy and Asulabha 2020 report post-restoration state for 40 lakes and a prior state for one; their protocol asks for five years of maintenance by the implementing agency and an environment health card for every lake, which is what this KPI would evidence | Derived; per work | Descriptive with confidence | Whether a measure held, and whether to repeat it elsewhere | New |
| V6 | Measure mapping | The deck's indicator-to-code table, driven by the section 9 verdicts rather than by composites, using the full code list of the Advisory on Urban Waterbody Rejuvenation (MoHUA with Arup, 15 November 2023): A1 to A6 flow management, B1 to B2 physical form, C1 to C3 vegetation (C3 aquatic weed removal, which the deck omits), D1.1 to D1.3 primary and D2.1 to D2.4 secondary treatment | Derived | The advisory's problem-to-measure matrix | The situation-assessment output for a DPR | New |
| V7 | Event register | Dated fish kills, froth spills and fires with attributed cause: compilations count 61 fish-kill incidents across 2017 to 2023, recurring at Haralur, Madiwala, Bellandur and Kommaghatta, with sewage-driven oxygen collapse the attributed cause in nearly all; Ulsoor March 2016 (night-time DO near zero); Bellandur fires February 2017 and January 2019 | Curated from KSPCB notices, NGT records and press; per event | List | Classifier validation dates (10.4); effectiveness (V5); alert calibration | New |

### 8.11 Coverage and confidence (X)

| Id | KPI | Definition | Cadence | Use |
|---|---|---|---|---|
| X1 | Clear passes | Count of passes meeting the 70% clear rule, per lake per month | Monthly | Shown next to every monthly statistic |
| X2 | Days since last clear observation | Per lake | Daily | The staleness badge; the monsoon reads honestly as 40 or 60 days |
| X3 | Valid pixel share and glint flags | Per pass | Per pass | Gate inputs |
| X4 | Confidence class | High, Medium, Low per KPI and per lake, from pixel and scene counts, season match, boundary provenance and sensor era (register section 6.5); rules in section 16.4 | Per run | Never changes a band; orders ties |

### 8.12 Declared gaps

Not measurable from Sentinel-2 or any listed sensor, and stated as such on every lake page:

- Dissolved oxygen, BOD, COD, nitrate and phosphate concentrations, faecal coliform, heavy metals, pesticides, pathogens: ground sampling only (G1, G2 name the station).
- Cyanobacterial taxon and toxins (Q10).
- Plastic versus foam versus organic debris: spectrally confused at 10 m (Biermann et al. 2020 defer inland waters; Hu 2022).
- Drains and inlet channels narrower than about 10 m; only their in-lake effect is seen (P2, P3).
- Optical chemistry from June to September on most passes; extent continues via SAR (H4).
- Bodies under 2 ha for optical quality; categorical state only (register K1 to K6).
- Diurnal stratification and night-time DO crashes (T3 is a risk flag, not an observation).
- Any peer-reviewed, ground-validated satellite retrieval for a Bengaluru lake: none was found for Bellandur, Varthur, Ulsoor, Jakkur, Hebbal or Sankey. The calibration campaign in section 10 would be the first.

## 9. From KPIs to verdicts

The deck's three composites average unlike quantities with fixed weights. We replace them with named states, each a published rule over the KPIs above, each requiring persistence, and each mapped to the same AMRUT 2.0 measure codes the deck uses. A state is what a lake page leads with; the KPIs are its evidence.

| State | Rule (all on the open-water core unless stated; "two passes" = two consecutive clear passes) | Severe when | Measures (AMRUT 2.0 codes, as in the deck) |
|---|---|---|---|
| Bloom | P7 on Q1 above the 90th percentile for two passes, or W2 at or above 20% of the footprint for two passes | Q1 above 0.4 (Mishra scum range) or W2 at or above 40% (Health Card E) | The advisory's "high concentration of nutrients" set: A3, A5, B2, C1, C2, D1, D2.1 to D2.4; its "stratification and low dissolved oxygen" set (A3, A4, A5, B1, C1, C2, D2.2) when T3 is raised; field sample for taxon (Q10) |
| Vegetation choke | W2 at or above 30% with W3 reading macrophyte rather than scum, sustained over a season | W2 at or above 40% | C3 aquatic weed removal and management, with inflow control (A1, D2.3); W6 audit scheduled |
| Turbid inflow | P7 on Q3 above the 90th percentile for two passes and P3 positive at an inlet sub-zone | P1 on Q3 above 50% | Turbidity set: B2, C1, C2, D1; D2.3 at the attributed inlet (P4) |
| Organic load | P7 on Q5 above the 90th percentile for two passes | With Bloom | Nutrient set; S1 check on the sewer-shed |
| Froth event | W4 above 5% at the outflow sub-zone on any clear pass | Above 20% | Public-safety response at the weir; W4 seasonal count feeds C8 |
| Dry-down | H2 below 50% of the same-season median for two passes outside the pre-monsoon minimum | Below 25% | Breach and seepage inspection; not a quality state |
| Encroachment change | B1 or B2 rises by more than 1 point year on year, corroborated by B3 | B1 band worsens | Survey and removal; B6 read |
| Insufficient | Any state whose inputs fail the section 7.8 floors in the current season | | Queue for the next clear pass or for a sub-metre read |

Rules are versioned with the data. When the partner wishes to retain the three composite names for continuity, each can be defined as a percentile of a z-scored sum against the lake's own baseline, with weights published; it is then a Tier 1 index like any other, not a verdict.

## 10. Calibration and validation protocol

### 10.1 What calibration needs, and what exists

Tier 2 requires in-situ measurements of satellite-calibratable parameters, matched in time and place to clear passes:

| Parameter | Unit | Calibrates | Instrument | In public KSPCB sheets |
|---|---|---|---|---|
| Turbidity | NTU or FNU | Q3, Q4 | Nephelometer or turbidity tube | Yes, a column in the monthly Bengaluru sheet; completeness per lake to be checked |
| Total suspended solids | mg per litre | Q8 | Lab gravimetric | Yes, same sheet |
| Chlorophyll-a | micrograms per litre | Q1, Q2, Q9 | Fluorometer or lab extraction | No. The CPCB monitoring guideline lists chlorophyll as an additional lake parameter and the AMRUT advisory requires it pre-, during and post-project, so the lever exists |
| Secchi depth | m | Q6 | Disc | No; the AMRUT advisory lists transparency |
| Surface temperature | C | T1 | Thermometer at 0.1 m | Yes |

The parameters the regulator classifies on (pH, EC, DO, BOD, coliform) have no optical signature and cannot calibrate any Q-series KPI; they remain first-class ground truth for G2. The monthly sheet's turbidity and TSS columns can calibrate Q3, Q4 and Q8 once the PDFs are extracted and the station points located, which makes the deck's TSS comparison reproducible and is the first calibration to run. Chlorophyll-a has no public series, so Q1, Q2 and Q9 stay Tier 1 until a campaign or a DPR monitoring programme supplies it. Once match-ups exist, the candidate Tier 2 models are, in order of data appetite: the single-band and band-ratio fits in section 8.2 (tens of samples), the Li et al. 2023 direct trophic-index fit (hundreds), and a locally retrained Mixture Density Network (Pahlevan et al. 2022 supply the code and recommend regional retraining, and their own satellite match-ups show why: a model at 29% error on laboratory spectra ran at 80-170% on orbit depending on the atmospheric processor).

Candidate sources, in order: KSPCB monthly sheets (turbidity, TSS, from July 2023 on the OpenCity mirror); AMRUT 2.0 DPR monitoring programmes, which under the advisory sample chlorophyll-a, TSS and transparency pre-, during and post-project and can be timed to passes at no extra cost; lake-group series (PNLIT monthly since 2016; Lake Health Index; Mira kits, the only citizen chlorophyll channel); IISc Centre for Ecological Sciences datasets (Ramachandra and colleagues hold chlorophyll and turbidity series for Bellandur and Varthur; their 2020 survey of 40 restored lakes, sampled 2016-2019 on a ten-parameter water quality index, found 4 in "good" condition, Jakkur among them, 15 "poor" and 21 "very poor", with sustained sewage inflow, partial desilting and reuse of contaminated silt as the causes named; it is a post-restoration snapshot, not a before-and-after); a designed campaign (10.3); citizen Secchi readings for Q6 once the sightings capture is live. No real-time water-quality station operates on any Bengaluru lake as far as the research could establish: the NGT-directed systems were not reported in place, ATREE's 2017-18 sensors failed from algal clogging, and BWSSB's real-time stations sit on STP outlets.

### 10.2 Match-up rules

- Sample within one day of a clear pass (Coffer and Schaeffer 2024 used 12 hours; the existing engine allows three days, which stays the maximum).
- Sample points inside the open-water core, at least 30 m from shore and away from macrophyte mats; a shoreline sample calibrates nothing.
- Satellite value = median of the 3 by 3 pixel window around the point, on the same reflectance product the served KPI uses.
- Per lake first; pooled across lakes only within an optical water type (open-water reservoir versus sewage-fed eutrophic lake are different types).
- Promotion gate as in the existing engine: at least 10 match-ups and R2 at least 0.5; RMSE, bias and the fitted coefficients published with date and provenance; a promoted KPI shows its error band on the chart.
- Validation is reported as numbers: n, r, R2, RMSE, bias, and a scatter plot per lake. "Along expected lines" is not a result.

### 10.3 Field campaign design

- Ten lakes, three points each, three dates per season across a pre-monsoon and a post-monsoon window: about 180 samples per year.
- Dates chosen the evening before from the Sentinel-2 acquisition plan and cloud forecast; the pass over Bengaluru is about 10:30 local, so sampling runs 09:30 to 12:00.
- Per point: Secchi depth, turbidity (nephelometer), chlorophyll-a (handheld fluorometer, with a subset sent for lab extraction to anchor the fluorometer), surface temperature, a photo of the surface, GPS. Lab BOD and DO on a subset align the campaign with the regulator's parameters.
- Cost is dominated by lab chlorophyll-a and TSS; a few thousand rupees per sample panel at an accredited laboratory is the order of magnitude to budget, to be confirmed with quotes.
- This campaign is the partner's natural contribution and the platform's calibration asset; it would also be the first ground-validated satellite retrieval on any Bengaluru lake.

### 10.4 Classifier validation

Before a lake's series is trusted, run the diagnose (percentile dump) and validate (per-scene table) modes around dates with known conditions: a documented froth event, a de-weeding date, a known clear state. Record the thresholds chosen per lake. The Bellandur run showed the default open-water-index design would have produced near-empty output; every hyacinth-prone lake needs this step.

## 11. Time series, baselines and alerts

- **Series**: one row per lake per clear pass since 28 March 2017 (the start of two-satellite operation) with every W, Q, P1, H1 and X value, and the scene id.
- **Baseline**: for each KPI and lake, the distribution of same-season values over all prior years with at least three years of data. Seasons: pre-monsoon (March to May), monsoon (June to September), post-monsoon (October to December), winter (January and February).
- **Anomaly**: P7 percentile; two consecutive clear passes above the 90th percentile raise a state (section 9); the 97th marks severe.
- **Monsoon rule**: optical KPIs are blank when no clear pass exists; H4 continues from SAR; the lake page reads "no optical observation for N days", never an interpolated value.
- **Alerts** (through the existing freshness and alert registry): bloom onset (P5) and severe bloom; froth event (W4); turbid inflow at an inlet (P3, P4); dry-down (H5); encroachment change (B1, B2); coverage lapse (X2 above 45 days outside the monsoon). Recipients: the custodian's lake wing, the lake group where one exists, KSPCB's regional office for froth and severe bloom. Language follows the platform's rule for government-facing text.
- **Monthly brief**: per lake and per corporation, the states in force, the month's KPIs with clear-pass counts, and any change since the previous brief; exported through the existing PDF path.

## 12. Outputs and serving

| Output | Form | Where |
|---|---|---|
| Per-lake state file | JSON, the existing `<body>-pollution-state.json` shape extended with W3, Q2, Q5 to Q9, P-series, H-series | `public/data/rich-bodies/` for rich bodies; a `lakes/` family for the screen tier, added to the build-time exclude list per the Turbopack trace rule |
| Per-pixel products | Cloud-optimised GeoTIFF chips per pass for P2 maps; seasonal PMTiles for the map | Object storage; PMTiles in `public/tiles/` |
| Lake page panel | The built pollution panel (composition stacked area, index lines, play animation) plus state badges, P2 overlay and the G and V rows | `/bangalore/water-bodies` rich-body overlay; the same component for every city |
| Corporation view | All lakes in a corporation with state, X2 staleness and confidence | Unified map layer; no ranking table in public |
| Methods as data | Formulas, thresholds, processor versions, per-lake classifier thresholds, calibration coefficients, with provenance and dates | Published JSON next to the data; the About page's methodology section |
| Situation-assessment export | The AMRUT 2.0 checklist fields this layer can fill (water quality proxies, LULC, inlets and outlets, storage proxy) with the fields it cannot (bathymetry, sediment quality, hydrogeology) marked for the DPR consultant | PDF and JSON |
| Health Card draft | Register entry with the C, T bands this layer computes and I for the rest | Register export |

## 13. Pilot plan and division of work

### 13.1 Phases

| Phase | Weeks | Content | Exit |
|---|---|---|---|
| 0. Reconcile the deck | 1-2 | Recompute the deck's ten lakes for April to May 2026 with the corrected NDTI, the composition gate and the open-water core; place the deck's Low, Moderate, High next to ours; agree which corrections the partner adopts | A joint note on the corrections |
| 1. Tier 1 for the GBA set | 4-6 | The chain on CDSE or AWS COGs for every GBA body 5 ha and above; W1 to W5, Q1, Q3, Q5, Q7, P1, P7, H1, X1 to X4; the 2017-2026 backfill; own baselines; state rules | 183 lakes with a state and a staleness figure |
| 2. Calibration | 8-12, in parallel | First the KSPCB monthly sheets: extract turbidity and TSS from July 2023, locate stations, run the engine on Q3, Q4, Q8. Then the field campaign (10.3) across one post-monsoon and one pre-monsoon window for chlorophyll-a and Secchi; IISc data request; any live AMRUT DPR's monitoring aligned to passes | G3 published for every Q-series KPI; first Tier 2 numbers or a clear statement of why not |
| 3. Structure and cause | 4-6 | Sub-zones for the lakes 20 ha and above from the cascade layer; P2 to P4; H4 SAR; N2, N3; S1, S3 from BWSSB; V1 to V4 joins | Inlet attribution on the top thirty lakes |
| 4. Serve and alert | 3-4 | Panel, corporation view, monthly brief, alerts to a pilot custodian and two lake groups; AMRUT situation-assessment export for one lake with a live DPR | A GBA pilot running through a summer |

Effort for phases 1, 3 and 4 is on the order of eight to twelve person-weeks on our side, reusing the built pipeline; phase 2 is field time and laboratory cost on the partner's side. Data cost is nil; compute is a small VM.

### 13.2 Division of work

| Partner | Platform |
|---|---|
| Field campaign and laboratory analysis; match-up dataset ownership shared | Processing chain, backfill, baselines, states |
| Per-lake classifier tuning and remote-sensing QA | Cascade, cause and governance joins; register alignment |
| GBA, KSPCB and lake-group relationships in Bengaluru | Serving, alerts, briefs, exports; multi-city reuse |
| AMRUT DPR consultant introductions | Methods-as-data publication and the About page |

### 13.3 Entry points that already exist

- The GBA Chief Commissioner in June 2026 directed corporation-wise action on the lakes KSPCB classed E (East 12, North 8, South 7, West 5, Central 1). A per-corporation view with states, staleness and the measure mapping is the working document that directive needs.
- NGT's 2018 order on Bellandur, Varthur and Agara directed satellite-imagery monitoring of the three lakes and real-time water-quality stations that were never reported in place; oversight sits with the Chief Secretary with quarterly reporting. A reproducible satellite record with published methods serves that obligation.
- AMRUT 2.0's operational guidelines require cities above 40 lakh to rejuvenate five water bodies, evaluated on water-quality improvement and drain diversion, and place DPR preparation with the state's project development and management consultants. The situation-assessment export (section 12) is what those consultants need for Stage 1, and the advisory's post-project monitoring is the calibration data for us.
- Corporate lake adoption is constrained: the Karnataka High Court stayed corporate MoUs in March 2020 and BBMP's 2024 community-involvement policy awaited the court's approval as of mid-2025. An adopter-facing product routes through that policy once approved, not through direct MoUs; more than sixty lake groups watching about 120 lakes are the nearer audience.

### 13.4 What sharper imagery is for

Sentinel-2 carries the monitoring. Higher resolution is bought per use: one Cartosat-3 or Pleiades scene per year over the GBA set for B6 boundary and inlet reads and for identifying bodies under 2 ha; tasked scenes after a froth or fish-kill event where evidence is needed. PlanetScope SuperDove (3 m, red edge present, no SWIR) is the behavioural Sentinel-2 equivalent for narrow lakes and was found to match S2 for chlorophyll retrieval on small Scottish lochs (Atton Beckmann et al. 2025); it becomes worthwhile only for a named use with a paying line. If the buyer is GBA, sub-5 m ISRO data is free to government entities on declaration under the 2023 space policy, which is the route to prefer for the annual read.

## 14. Decisions needed

1. Compute platform for the served product: CDSE or AWS COGs from phase 1 (recommended), with GEE kept for research and the register proof of concept.
2. Whether the partner adopts the section 2.2 corrections before the deck circulates further.
3. Boundary anchor: the OpenCity ATREE-CSEI layer is CC BY but undocumented in provenance; whether a KTCDA, EMPRI inventory or survey boundary can serve as the legal anchor, with the OpenCity layer as the mapped one.
4. Ownership and publication of the match-up dataset (recommended: open, with both names on it).
5. Whether the three composite names survive as Tier 1 indices (section 9) or are retired.
6. The first pilot custodian and the two lake groups for alerts.
7. Who extracts the KSPCB monthly PDFs (ours to build, on the OpenCity mirror) and who approaches IISc for the historical chlorophyll and turbidity series and KSPCB for station coordinates.
8. Whether to propose pass-aligned sampling dates to any live AMRUT DPR in the city, which turns a required monitoring programme into a match-up set.

## 15. References

Full URLs and confidence notes are in the research record for this note (three sourced research threads, 3 Sep 2026). Key references:

- Mishra and Mishra 2012, NDCI, Remote Sensing of Environment 117:394-406.
- Lacaux et al. 2007, NDTI, Remote Sensing of Environment 106:66-74.
- Hu 2009, Floating Algae Index, Remote Sensing of Environment 113:2118-2129.
- Nechad, Ruddick and Neukermans 2009, generic multisensor turbidity algorithm, Proceedings of SPIE 7473; Nechad, Ruddick and Park 2010, single-band SPM, Remote Sensing of Environment 114:854-866; Dogliotti et al. 2015, switching turbidity, Remote Sensing of Environment 156:157-168.
- Coffer, Schaeffer et al. 2024, Sentinel-2 chlorophyll across 103 US lakes, Remote Sensing 16:1977.
- Pahlevan et al. 2020 and 2022, Mixture Density Networks for chl-a, TSS and CDOM, Remote Sensing of Environment 240:111604 and 270:112860.
- Tavares et al. 2025, small optically diverse lakes from 3 ha, Remote Sensing 17:2729; Joffre et al. 2025, lakes above 1 ha, Ecological Indicators 114536.
- Toming et al. 2016, first Sentinel-2 lake study (CDOM, DOC), Remote Sensing 8:640; Al-Kharusi et al. 2020, Remote Sensing 12:157.
- Lee et al. 2015, Secchi depth theory, Remote Sensing of Environment 169:139-149; Soomets et al. 2020, Sensors 20:742.
- van der Woerd and Wernand 2018, hue angle for MSI and OLI, Remote Sensing 10:180; Wang et al. 2018, Forel-Ule trophic state, Remote Sensing of Environment 217:444-460; Li et al. 2023, remote quantification of the trophic status of Chinese lakes, Hydrology and Earth System Sciences 27:3581-3599.
- Warren et al. 2019 and Pahlevan et al. 2021 (ACIX-Aqua), atmospheric-correction intercomparisons, Remote Sensing of Environment 225 and 258.
- Paulino et al. 2022, adjacency effects, Remote Sensing 14:1829; Harmel et al. 2018, sun-glint correction of Sentinel-2 from SWIR bands (the GRS processor), Remote Sensing of Environment 204:308-321.
- Pasquarella et al. 2023, Cloud Score+, CVPR Workshops.
- Attiah et al. 2023, Landsat lake surface temperature, Earth System Science Data 15:1329; Vanhellemont 2019, Remote Sensing of Environment 237:111518.
- Mishra et al. 2019, cyanobacterial bloom magnitude and frequency (CyAN), Scientific Reports 9:18310; Wang et al. 2025, global lake bloom phenology, National Science Review.
- WHO 2021, Toxic Cyanobacteria in Water (2nd ed.) chapter 5, and Guidelines on Recreational Water Quality.
- Carlson 1977, Trophic State Index (NALMS equations).
- Bareuther, Klinge and Buerkert 2020, Bellandur and Varthur macrophytes and algae 2002-2019, Remote Sensing 12:3843; Sourav et al. 2024, built-up in lake buffers, Environmental Challenges 15:100944.
- Kulranjan and Srinivasan 2026, sewage share of inflow in the Hebbal-Nagavara cascade, Frontiers in Water; Ramachandra et al. 2017, Bellandur and Varthur rejuvenation blueprint, IISc ENVIS TR 116.
- Das et al. 2023, surfactant mechanism of Bellandur foam, Science of the Total Environment.
- Uday et al. 2025, radar versus optical water mapping through the Indian monsoon, PLOS One; Simpson et al. 2022, hyacinth from Sentinel-1 on Vembanad, Remote Sensing 14:2845; Herndon et al. 2020, surface-water detection methods against 0.5 m reference in the Nigerien Sahel, Sensors 20:431.
- Caroni et al. 2025, monsoon lag on 42 Indian lakes, Journal of Water and Climate Change 16:3372.
- Brown et al. 2022, Dynamic World, Scientific Data 9:251; JRC Global Surface Water v1.5 (2026).
- Copernicus Data Space Ecosystem notices on Sentinel-2A extension (May 2026) and processing baseline 05.12 (February 2026); Google Earth Engine noncommercial terms.
- BCAP full report (BBMP, C40, WRI India, 2024); SANDRP, Bengaluru lakes 2025 review (February 2026); Karnataka Tank Conservation and Development Authority (Amendment) Bill 2025.
- MoHUA with Arup, Advisory on Urban Waterbody Rejuvenation (AMRUT 2.0, AIWASI), 15 November 2023, amrut.mohua.gov.in; MoHUA, AMRUT 2.0 Operational Guidelines, October 2021.
- CPCB, Designated Best Use water quality criteria; CPCB, Guidelines for Water Quality Monitoring (MINARS/27/2007-08); CPCB, National Inventory of Sewage Treatment Plants, March 2021.
- KSPCB, Classification of Water Quality under NWMP April 2025 to February 2026, and monthly Bengaluru lake sheets (kspcb.karnataka.gov.in; OpenCity mirror data.opencity.in).
- OpenCity, Map of Lakes and Streams of Bengaluru Urban (ATREE-CSEI, CC BY, updated 26 February 2026); EMPRI, Inventory of Lakes, Bengaluru Metropolitan Area (2018).
- NGT, OA 125/2017 and OA 217/2017 orders of 6 December 2018, 21 October 2019, 12 March 2021 and 9 May 2023; Karnataka High Court, WP 38401/2014 order of 1 August 2023 and WP 817/2008 judgment of 11 April 2012.
- CAG, Performance Audit on Conservation and Ecological Restoration of Lakes (Report 1 of 2015); CAG, Performance Audit on Storm Water Management in Bengaluru (2021), chapter 5.
- BWSSB Sewage Treatment Plants Dashboard (stpp.bwssb.gov.in); Greenvironment on KSPCB's OCEMS resolution of 21 January 2026.
- Ramachandra, Sincy and Asulabha 2020, Efficacy of rejuvenation of lakes in Bengaluru, Green Chemistry and Technology Letters 6(1):14-26; Ramachandra, Vinay, Bhat, Settur and Aithal 2017, Unabated violations in Agara Bellandur wetland, IISc ENVIS Technical Report 134; IISc ENVIS TR 76 (Jakkur); Nagendra 2016 (Kaikondrahalli, Kalpavriksh); Bergman et al. 2026, From drivers to responses: restoring urban lakes in Bengaluru, Water 18:1168.
- CGWB, Ground Water Information Booklet, Bangalore Urban District; CGWB Annual Ground Water Quality Report 2024.
- Citizen Matters (2022-2025) on lake custodians, MoUs and the 2024 policy; Newskarnataka (February and June 2026) on KSPCB classifications; Deccan Herald on BBMP lake budgets and STP expansion.

## 16. Uncertainty, confidence and resolution sensitivity

Every KPI carries an error bound and a confidence class, and both change with the sensor's pixel size, band set and revisit. This section gives the error model, the bound per KPI, the rules that turn them into the confidence class X4, and how each bound moves when the resolution moves. Numbers marked "derived" come from geometry or from the sampling model in Appendix D and are stated with their assumptions; numbers marked with a citation are published validation results and are upper bounds on what to promise until local match-ups exist (section 10).

### 16.1 Error model: eight components

| Component | What it is | How it scales with pixel size | How it scales with revisit | KPIs it dominates |
|---|---|---|---|---|
| E1 Retrieval and atmospheric correction | The algorithm's own error against in-situ truth, including the atmospheric-correction processor's residuals (20-30% at red and green for the best processors on inland waters, Pahlevan et al. 2021; above 100% in the red and 1,000% in the near-infrared for every processor on inland water, and the red-edge to red ratio not reproduced by any, Warren et al. 2019) | Does not fall with finer pixels. It depends on radiometric quality and bands: Sentinel-2 is the best-calibrated open sensor here; PlanetScope SuperDove reflectance differs from reference by 15-20% (Vanhellemont 2023) | Unchanged | Q1 to Q9, T1 |
| E2 Sampling | Standard error of a lake mean or fraction from a finite number of independent pixels; independent pixels are fewer than pixels because neighbours are correlated | Falls as pixel size falls: the number of pixels grows with the inverse square of pixel size, effective number less steeply. Derived values in Appendix D | Unchanged per pass; falls with more passes for seasonal statistics | Lake means, W fractions, P1, P2, P3 |
| E3 Edge and adjacency | Mixed shoreline pixels (removed by the ring, at the cost of area) and light scattered from bright land into dark water (adjacency), which reaches 100-300 m from shore in the NIR over dark water (Paulino et al. 2022) | The ring loss is proportional to pixel size times perimeter over area (Appendix D). The adjacency range is fixed in metres and does not shrink with finer pixels; a 5 ha lake sits 96% within 100 m of shore at any resolution (derived, circular) | Unchanged | All optical KPIs on lakes under 20 ha; Q1 and Q2 most (red-edge and NIR) |
| E4 Classification | Per-class accuracy of the composition classifier and of land-cover products; mixed pixels at class boundaries | Boundary mixing falls with finer pixels; per-class confusion does not unless bands improve. Published: floating-vegetation mapping 79-90% overall accuracy on Sentinel-2 (Anzali, 2024), with per-class accuracy lower; Dynamic World water and built classes are per-scene and noisy at low confidence; global water products miss small turbid bodies (Herndon et al. 2020) | Annual modes reduce noise (already used for built trend) | W1 to W6, B1, B2, H1 |
| E5 Temporal sampling | Clear passes are the observations; an onset date is known only to within the gap between them; a seasonal statistic from few passes is unstable | Unchanged | Falls with revisit and clear-sky frequency: Sentinel-2 over Bengaluru acquires every 2.3 days (section 6.2); clear passes are far fewer in the monsoon | P5, P6, P8, H3, H5, V5 |
| E6 Baseline estimation | The lake's own 90th percentile is estimated from a finite history; with 30 same-season observations its rank has a standard error of about 5.5 percentile points, with 100 about 3 (derived, binomial) | Unchanged | Falls with years of archive; needs at least 3 seasons (section 7.8) | P7 and every state in section 9 |
| E7 Geometry and boundary | Co-registration (Sentinel-2 sub-pixel; JRC v1.5 up to one 30 m pixel between Landsat collections) and the provenance of the footprint and buffer polygons | Falls with finer pixels for the raster part; the polygon part depends on provenance, not pixels. The KTCDA statutory buffers of 3 to 24 m are narrower than a 10 m pixel, so B2 on those buffers cannot come from a 10 m raster at all | Unchanged | H2, B1, B2, B3, N4 |
| E8 Ground-truth join | Whether the in-situ sample represents the open-water core (a shoreline grab sample does not), the date gap to the pass, and the laboratory's own precision | Unchanged | Falls with pass-aligned sampling (10.3) | G-series and every Tier 2 coefficient |

The consequence that matters most for the partner discussion: finer pixels shrink E2, E3's ring term, E4's boundary term and E7, and a daily constellation shrinks E5; nothing about resolution shrinks E1, E3's adjacency term, E6 or E8. For lakes above about 20 ha at Sentinel-2 resolution, E1 already dominates every Q-series KPI, which is why calibration, not resolution, is the binding investment (section 13.4).

### 16.2 Error bounds per KPI

"Tier 1 bound" is what can be said before local calibration; "Tier 2 bound" is the published accuracy of the calibrated retrieval on comparable water, quoted as an upper bound on what to promise. "Shown as" is what the chart or table carries next to the number.

| Id | Error metric | Tier 1 bound | Tier 2 bound (published, comparable water) | Dominant components | Shown as |
|---|---|---|---|---|---|
| W1, W5 | Fraction, percentage points | Ring loss for the lake's size (Appendix D: 8% of area on a 20 ha lake at 10 m, 23% on 2 ha) plus the class confusion measured in the validate run; before validation assume plus or minus 10 points | Not applicable | E3, E4 | Fraction with the validate-run confusion and the ring share stated |
| W2 | Fraction, points | As W1; published floating-vegetation overall accuracy 79-90% on Sentinel-2 implies roughly plus or minus 10 points on a fraction before local tuning | Not applicable | E4, E3 | Fraction plus or minus points; Health Card band only when the band is wider than the error |
| W3 | Class split, points | Unvalidated split; Medium confidence at best until validated against photographs or a sub-metre scene | Not applicable | E4 | Split shown with "unvalidated" label |
| W4 | Events per season, lower bound | Undercount: froth patches narrower than about three pixels (30 m) are missed; detection of the class itself validated on known froth dates | Not applicable | E4, E2 | "at least N events"; per-event confidence from patch size |
| W6 | Difference of two W2 values | Sum in quadrature of the two W2 errors; a change smaller than that is "no measurable change" | Not applicable | E4, E5 | Before and after with the combined error band |
| Q1 NDCI | Index units; Tier 2 in mg per m3 | Scene-to-scene consistency measured as the within-season spread on a stable reference (Chembarambakkam-type open water); the index itself is precise to about 0.01-0.02 from radiometric noise, atmospheric residuals add more | Mishra and Mishra 2012 calibration: standard error 2.49 mg per m3 on the calibration set (MERIS, not transferable); small-lake framework (Tavares et al. 2025): MAPE 56%, RMSE 11.4 mg per m3; US lakes (Coffer and Schaeffer 2024): typical error a factor of about 2; global MDN (Pahlevan et al. 2022): 29% on held-out spectra but 80% (SeaDAS) to 170% (ACOLITE, judged not viable) on Sentinel-2 satellite match-ups, which is the honest gap between laboratory and orbit | E1, then E3 on small lakes | Percentile with n; Tier 2 value with plus or minus one MAPE band |
| Q2 MCI | As Q1 | As Q1 | Coffer and Schaeffer 2024: mean absolute error factor 2.08, bias factor 1.15, 82% correct on eutrophic versus not, detection limit about 10 micrograms per litre | E1 | As Q1; trophic-class call with 82% stated |
| Q3 NDTI | Index units | Qualitative; repeat-pass consistency only | None published | E1, E3 | Percentile with n |
| Q4 turbidity | FNU | Not shown in units at Tier 1 | Dogliotti et al. 2015: mean relative error 13.7% overall, 11.6-21.8% by site, bias 4.8%, valid 1 to 1,000 FNU; the red branch adds 19-57% error at chlorophyll-a of 10-30 mg per m3; Nechad et al. 2009: 30-35% relative error below 708 nm; Tavares et al. 2025: MAPE 47%, RMSE 9.7 NTU on lakes from 3 ha | E1 | Value with plus or minus the local RMSE once calibrated, else the 47% band; red-branch values flagged when Q1 reads bloom |
| Q5 CDOM proxy | Ratio units | Published band-ratio fits explain 28-72% of variance across studies (Al-Kharusi et al. 2020; Toming et al. 2016), so the proxy ranks lakes and seasons but does not size them | Global inversion (C2RCC) R2 0.91 on Baltic lakes (Soomets et al. 2020); MDN 34.5% on held-out spectra, 80-107% on satellite match-ups (Pahlevan et al. 2022); untested on sewage-fed tropical water | E1 | Percentile only; Low to Medium confidence |
| Q6 Secchi | m | Not shown at Tier 1 | Soomets et al. 2020: RMSE 0.36 m, R2 0.97 (Baltic, C2RCC); Lee et al. 2015: about 18% absolute difference across 338 samples | E1 | Metres plus or minus 0.4 m until local |
| Q7 hue angle, FUI | Degrees; FUI class | Hue angle from MSI bands within 4-5 degrees of hyperspectral truth on 603 coastal and inland spectra (van der Woerd and Wernand 2018), which is about one Forel-Ule class in the green-brown range; Sentinel-2 FUI against in-situ r2 0.52 with 7.8% error on Wuhan lakes (Zhou et al. 2021), 92.5% class accuracy on MODIS (Wang et al. 2018) | As Tier 1; the class is the product | E1 (small) | FUI class plus or minus one class |
| Q8 SPM | mg per litre | Not shown at Tier 1 | Nechad et al. 2010 calibration R2 0.79 at 665 nm; small-lake turbidity MAPE 47% as the working band | E1 | Value with the 47% band until local |
| Q9 TSI | Index points | Not shown at Tier 1 | Propagated from chlorophyll: a 56% chlorophyll error is 4.4 TSI points (derived from 9.81 times ln 1.56); the direct reflectance route gives RMSE 4.1 (machine-learned) to 7.9 (single band ratio) TSI points on validation lakes (Li et al. 2023); a class call within 4 to 8 points of a boundary is undecided | E1 | TSI with plus or minus 4 to 8 points; class only when clear of the boundary |
| Q10 | Not retrievable | | | | Gap |
| P1 | Points on a fraction | Binomial standard error from the effective pixel count (Appendix D): plus or minus 2.1 points on a 20 ha lake at 10 m, 7.4 points on 2 ha, 0.5 points on 300 ha, plus the threshold's own uncertainty (E6) | Not applicable | E2, E6 | Fraction plus or minus the standard error |
| P2 | Persistence share per pixel | Standard error of a proportion over N passes: with 20 passes a 50% persistence is known to plus or minus 11 points, so the 60% hotspot rule needs at least 25 clear passes in the window to separate a hotspot from chance (derived) | Not applicable | E5, E2 | Map shown only when N clears 25; N in the legend |
| P3 | Difference of two zone means | Sub-zone polygons of 100-150 m hold 100-225 pixels at 10 m before masking, often 50 after, so the sub-zone side of the difference carries most of the error; persistence share carries the same N rule as P2 | Not applicable | E2, E5 | Difference with its standard error and the persistence N |
| P5 onset, duration | Days | Plus or minus half the median gap between clear passes in the window (derived): about 2-4 days in the Bengaluru dry season for Sentinel-2, undefined in the monsoon; duration carries one gap at each end | Not applicable | E5 | Date with plus or minus days; monsoon onsets not reported |
| P6 | Index units, seasonal | Maximum-value composites inflate when the constellation changes (Coffer et al. 2025); report only within a constant-sensor era, or use the seasonal median of per-pass maxima | Not applicable | E5, E1 | Value with era label |
| P7 | Percentile points | Standard error of the percentile rank from the baseline count: plus or minus 5.5 points at n = 30, 3 at n = 100 (derived); a state is raised only when the observed percentile exceeds 90 plus that error | Not applicable | E6 | Percentile with baseline n |
| P8 | Coefficient of variation | Descriptive; needs at least 4 clear passes | Not applicable | E5 | Value with n |
| H1 | Hectares | Ring share for the lake's size at 20 m (the MNDWI band) plus vegetation-versus-water confusion; optical water masks exceed 98% agreement in clear conditions (Uday et al. 2025) but floating mats read as land | Not applicable | E3, E4 | Area plus or minus the ring share; "vegetated, extent uncertain" flag when W2 is high |
| H2 | Share of FTL | H1 error plus the FTL polygon's provenance; an unsurveyed FTL can be off by more than the raster error | Not applicable | E7 | Share with boundary provenance label |
| H3 | Months | Plus or minus one month; monsoon months rest on SAR | Not applicable | E5, E4 | Months with the SAR-month count |
| H4 | Hectares (SAR) | Wind roughening causes omission of open water; emergent vegetation causes commission; screen with ERA5 wind and W2; above 98% in calm clear conditions (Uday et al. 2025) | Not applicable | E4 | Area with wind flag |
| T1 | Degrees C | Landsat surface temperature RMSD 1.7 C with a water-specific method (Attiah et al. 2023) to 3.7 C for the standard product (Dyba et al. 2022); skin temperature at about 10:30 only | As Tier 1 | E1 | Value plus or minus 2 C |
| T2 | Degrees C, difference | One 100 m pixel per sub-zone: the difference carries at least the T1 error twice; indicative only | Not applicable | E2, E1 | Difference labelled indicative |
| T3 | Flag | Research-grade; no bound | | | Flag with "risk, not observation" |
| B1 | Points | Dynamic World annual mode inside a fixed footprint; ring of 30 m removed; structure count from footprints is near-exact for mapped buildings; band call only when the band width exceeds the estimated error (a few points) | GHSL built surface IoU 0.92 at 10 m as the cross-check | E4, E7 | Fraction with the structure count |
| B2 | Points | Statutory buffers of 3-24 m are sub-pixel at 10 m: from a 10 m raster the finding is Low confidence by construction; from building footprints (Overture, Open Buildings) or a sub-metre scene it is High | Not applicable | E7 | Source named; raster-only findings never lead |
| B4 | Points | GHSL and Dynamic World disagree by a few points on built share; catchment polygons are terrain-derived | Not applicable | E4, E7 | Value with source |
| B6 | Categorical | Reader agreement on the structured read (register protocol); two readers where a legal use is intended | Not applicable | E7 | Present, absent, uncertain |
| N1 to N4 | Categorical | Edge confidence class from the cascade layer (Bengaluru: 834 high, 195 medium, 24 low of 1,053 edges) | Not applicable | E7 | Edge class carried through |
| S1 to S7 | Numbers from sources | Source vintage and inter-source spread (section 8.8 shows three sewage figures that differ by up to 8%) | Not applicable | E8 | Range with source and year |
| G1 to G5 | Match-up quality | Distance from station to core, date gap, laboratory precision; a shoreline station is Low for calibration and High for G2 | Not applicable | E8 | Join quality class |
| V1 to V7 | Documentary | Source class: order or gazette (High), tender or budget line (Medium), press (Low) | Not applicable | | Source class |
| X1 to X4 | Exact counts | None | | | As is |

### 16.3 How the bounds move with resolution

Five sensor classes are relevant. The table gives, for each, the band and revisit facts that drive E1, E3 and E5, and the smallest lake on which a lake mean and a per-pixel map are defensible (derived: at least 100 interior pixels for a mean, 1,000 for a map, after the ring; Appendix D).

| Sensor class | Pixel | Bands relevant to water | Revisit | Radiometry for water | Smallest lake, lake mean | Smallest lake, per-pixel map | Ring loss on a 5 ha lake | Notes |
|---|---|---|---|---|---|---|---|---|
| Sentinel-3 OLCI (Copernicus lake product) | 300 m | Red edge, 620 and 681 nm (cyanobacteria index possible), SWIR absent | Daily | Designed for water | About 100 ha for any pure pixel; the Copernicus product targets lakes above 50 ha | Not applicable | 100% (no interior pixel) | Covers under 0.7% of US water bodies against 98.8% for Sentinel-2 (Salls et al. 2024); in Bengaluru only Hesaraghatta, Bellandur, Hosakote and Varthur would yield a handful of pixels |
| Landsat 8 and 9 | 30 m optical, 100 m thermal | No red edge; thermal present; archive to 1984 | 8 days combined | Good | About 20 ha (interior pixels above 100) | About 100 ha | 42% | Q1, Q2 unavailable (no 705 nm); chlorophyll via blue-green or red-NIR algorithms performs worse on turbid water (Sentinel-2 outperformed Landsat 9 for chl-a on Tamil Nadu reservoirs, Advances in Space Research 2025); T1 available; onset error about plus or minus 4 days at best |
| Sentinel-2 | 10 m (B2, B3, B4, B8), 20 m (B5, B6, B11) | Red edge at 705 and 740 nm (NDCI, MCI), SWIR (MNDWI, FAI, glint), no thermal | 2.3 days over Bengaluru | Best open-data calibration | 2 ha at 10 m bands; 5 ha at 20 m bands | 20 ha (10 m bands); 50 ha (20 m bands) | 15% at 10 m, 29% at 20 m | The reference; no lake-size effect on retrieval error above 3 ha (Tavares et al. 2025) |
| PlanetScope SuperDove | 3 m | Coastal blue, red edge at 705 nm (NDCI yes, MCI no: no 740 nm), no SWIR (no MNDWI, no FAI, weaker glint and atmospheric correction), no thermal | Daily, cloud permitting | Cross-sensor consistency 15-20% (Vanhellemont 2023); on six small Scottish lochs chlorophyll retrieval matched Sentinel-2 (R2 0.64 against 0.61, Atton Beckmann et al. 2025) | 0.5 ha | 2 ha | 5% | E2, E3 ring, E4 boundary and E5 all fall; E1 does not fall and can rise; W3 and the froth rule lose their SWIR term; commercial |
| Cartosat-3, Pleiades, WorldView | 0.3-1 m multispectral | Four to eight bands; WorldView-3 has red edge and coastal; Cartosat-3 four bands; no SWIR on most; tasked | On order | Not designed for water; sun-angle and glint issues | Water-quality means not recommended | Composition and boundary maps on any lake | Under 2% | B6, W3 validation, W4 patch size, structures: High; Q-series: Low or unavailable |

Per KPI group, the direction of the bound relative to Sentinel-2:

| KPI group | Finer (3 m, daily) | Coarser (30 m, 8-day) | Reason |
|---|---|---|---|
| W1, W2, W5 fractions | Error falls, roughly in proportion to the ring loss (Appendix D: 5 ha lake 15% to 5%) plus fewer mixed pixels at patch edges. On large lakes the gain is small: Bareuther et al. 2020 classified the same 20 March 2019 scene of Bellandur from Sentinel-2 at 10 m (83.3% macrophyte, 2.7% algae, 14.0% open water) and from WorldView-3 at about 1 m (82.3, 2.9, 14.8), a difference of about one point; Varthur differed by up to 3.7 points | Error rises; below about 5 ha the fraction is not computable | E3 ring and E4 boundary terms scale with pixel size |
| W3 mat versus scum | Worse without SWIR unless validated another way; better patch geometry | Unavailable on small lakes | FAI needs SWIR; NDVI alone conflates classes |
| W4 froth | Improves: patches of 10 m and up detected instead of 30 m and up; daily revisit catches short events | Effectively unavailable | Patch size and E5 |
| Q1, Q2 chlorophyll | Q1 unchanged to slightly worse (E1 radiometry); Q2 unavailable (no 740 nm); on lakes under 5 ha the ring gain outweighs the radiometry loss and the net is better | Unavailable (no red edge); substitute algorithms carry larger error on turbid water | E1 is sensor-bound, not pixel-bound |
| Q3, Q4, Q8 turbidity and SPM | Ring gain on small lakes; E1 unchanged or worse; glint and atmospheric correction weaker without SWIR | Available; ring loss triples; 20 ha minimum | Red and NIR bands exist on all classes |
| Q5 CDOM | As Q3 | Available, coarser | Green and red bands exist on all classes |
| Q6, Q9 Secchi, TSI | Depend on Q1 and Q4 at Tier 2; same movement | Q9 unavailable via chlorophyll; via Secchi only | Derived KPIs |
| Q7 hue angle | Unchanged to slightly worse (radiometry); coastal blue helps | Available; ring loss | Colour is robust to pixel size |
| P1, P2 fraction and hotspot maps | Error falls (P1 on 2 ha: 7.4 to 2.0 points); maps become defensible from 2 ha instead of 20 ha | Maps only on lakes above 100 ha | E2 |
| P3, P4 sub-zone and attribution | Improves markedly: sub-zones hold 10x more pixels; plumes narrower than 30 m resolved | Unavailable below 50 ha | E2, E3 |
| P5, P6 phenology | Onset error falls from about 3 days to about 1 day, cloud permitting | Rises to about 4 days or more | E5 |
| P7 anomalies | Unchanged in principle; the baseline is shorter for any newer sensor, so E6 is worse for years | Unchanged; longer archive | E6 |
| H1, H2 extent | Ring loss falls; no SWIR means the water mask relies on NDWI, which confuses turbid water and mats more than MNDWI does | Coarser; 20 ha minimum for a monthly extent | E3, E4 |
| H4 SAR extent | Not applicable (optical class) | Not applicable | Sentinel-1 and NISAR carry this |
| T1, T2 thermal | No finer open thermal sensor exists; unchanged | Unchanged (Landsat is the source) | Thermal is 100 m on every open sensor |
| B1, B2, B3 boundary | Improves; B2 on statutory buffers becomes measurable from a raster at sub-metre only | Worse; B2 unavailable | E7: buffers are 3-24 m |
| B4 catchment | Unchanged | Unchanged | Catchment scale swamps pixel size |
| B6 sub-metre read | This is the sub-metre product | Not applicable | |
| N, S, G, V, X | Unchanged | Unchanged | Not pixel-based |

Two conclusions follow. First, for the Q-series on lakes above 20 ha, the bound is set by E1 and does not move with resolution; only calibration moves it. Second, for lakes under 5 ha and for W4, P2 to P5 and B2, resolution is the binding term and a 3 m or sub-metre product changes what can be said. That is the basis of section 13.4: Sentinel-2 for the monitoring feed, sharper imagery bought per use for the KPIs in the second group.

### 16.4 Confidence rules (X4, formalised)

A confidence class is computed per KPI, per lake, per period, as the worst of the applicable component classes. It never changes a value or a band; it is shown beside them and orders ties.

| Component | High | Medium | Low | Insufficient |
|---|---|---|---|---|
| Interior pixels after the ring (E2, E3) | 1,000 or more | 100 to 999 | 20 to 99 | Under the section 7.8 floor |
| Share of lake within 100 m of shore (E3 adjacency) | Under 30% | 30-60% | Over 60% | |
| Clear passes in the period (E5) | 8 or more | 4 to 7 | 2 to 3 | Under 2 |
| Baseline observations behind a percentile (E6) | 100 or more | 30 to 99 | 10 to 29 | Under 10 or under 3 seasons |
| Classifier validation (E4) | Validated on this lake with known dates | Validated on a lake of the same type | Default thresholds | |
| Calibration (E1, Tier 2 only) | n at least 30 and R2 at least 0.7, local | n at least 10 and R2 at least 0.5, local | Published coefficients from comparable water | Not promoted: stays Tier 1 |
| Boundary provenance (E7) | Legal or survey | Observed maximum (JRC) | Mapped (OSM, OpenCity) | None |
| Sensor era (E1, E6) | Single sensor and processing baseline | Two eras with a splice offset | Mixed | |
| Ground-truth join (E8) | Inside the core, within 1 day | Inside the footprint, within 3 days | Shoreline station or over 3 days | No station |
| Documentary source (V) | Order or gazette | Tender, budget, register | Press or compilation | Unsourced |

Reporting rules that follow:

1. Every number is shown with its bound (standard error or published band) and its confidence class; a number without both is not published.
2. A state (section 9) is raised only when the observed percentile exceeds the threshold by more than the E6 error, on two consecutive clear passes.
3. A band (Health Card A to E) is shown only when the band width exceeds the estimated error; otherwise the value is shown with the two candidate bands.
4. A before-and-after difference (W6, V5) is "no measurable change" when it is smaller than the combined error of its two terms.
5. A per-pixel map carries its clear-pass count N in the legend and is withheld under N = 25.
6. A Tier 2 unit is shown only for a KPI whose calibration row (G3) is Medium or High; everything else is a percentile.

## Appendix A. Formulas: the deck's and the corrected set

Bands are Sentinel-2 MSI; reflectance in 0 to 1; all computed on the open-water core after masking.

| Quantity | Deck | This note | Native resolution | Note |
|---|---|---|---|---|
| NDCI | (B5 - B4)/(B5 + B4) | Same | 20 m | Correct as in the deck |
| NDTI | (B3 - B4)/(B3 + B4) | (B4 - B3)/(B4 + B3) | 10 m | Sign corrected to Lacaux et al. 2007; the deck's thresholds assume this |
| TSS proxy | B4/B8 | Retired; Q8 uses Nechad 2010 on aquatic-corrected B4 (Tier 2), Q3 uses NDTI (Tier 1) | | No literature support for B4/B8; the ratio is positive-only and conflates sediment with floating vegetation |
| CDOM proxy | B4/B2 | B3/B4 | 10 m | Toming et al. 2016; absolute aCDOM only by inversion |
| MNDWI | not used | (B3 - B11)/(B3 + B11) | 20 m | Water mask (Xu 2006) |
| NDVI | not used | (B8 - B4)/(B8 + B4) | 10 m | Algae and macrophyte class |
| FAI | not used | B8 - [B4 + (B11 - B4) x (833 - 665)/(1614 - 665)] | 20 m | Hu 2009; scum and mat discrimination |
| MCI | not used | B5 - B4 - (B6 - B4) x (705 - 665)/(740 - 665) | 20 m | Coffer and Schaeffer 2024 |
| Froth rule | not used | mean(B3, B4, B8) > 0.18 and B11 > 0.10 and NDVI < 0.10 | 20 m | Existing classifier; lower bound |
| Hue angle | not used | CIE tristimulus from B2, B3, B4 (B5) with MSI weights, then atan2 | 10 m | van der Woerd and Wernand 2018 |
| Composites | Fixed-weight means of raw indices | Named states by rule (section 9); optional z-scored percentiles with published weights | | |

## Appendix B. Bengaluru district water bodies by size (cascade layer, 1,025 bodies)

| Size | Count | Share |
|---|---|---|
| 50 ha and above | 51 | 5% |
| 20 to 50 ha | 108 | 11% |
| 5 to 20 ha | 404 | 39% |
| 2 to 5 ha | 305 | 30% |
| 0.5 to 2 ha | 157 | 15% |

Largest named bodies in the layer: Hesaraghatta 598 ha, Bellandur 316 ha, Hosakote 308 ha, Varthur 155 ha, Yellamallappa Chetty 138 ha, Hennagara 121 ha, Yelahanka 96 ha (which drains to Jakkur). Bellandur sits at cascade position 7 with four inflows; Varthur at position 5 with five, draining to Kelavarapalli reservoir.

## Appendix C. Papers to obtain in full

Fetch blocks or paywalls prevented reading these in full during the research pass; each carries a number this note relies on.

| Paper | Why it matters here | Access |
|---|---|---|
| Lacaux et al. 2007, RSE 106:66-74 | NDTI original formula and sign, cited in section 2.2 from secondary sources | Paywalled |
| Nechad, Ruddick and Park 2010, RSE 114:854-866 | Q8 SPM coefficients and the C values used by the 2009 turbidity paper; the 2009 SPIE paper was obtained instead (A values confirmed, C not printed in it) | Still to obtain |
| Dogliotti et al. 2015, RSE 156:157-168 | Q4 switching thresholds confirmed from the paper; no Sentinel-2 band mapping is given in it | Obtained |
| Pahlevan et al. 2022, RSE 270:112860 | MDN for chl-a, TSS and CDOM; sensitivity to atmospheric correction | Obtained; findings folded in |
| Warren et al. 2019, RSE 225:267-289 | Atmospheric-correction errors over inland water; section 7.2 | Obtained; findings folded in |
| Wang et al. 2018, RSE 217:444-460 | Forel-Ule trophic classes for Q7 | Still to obtain (Li et al. 2023, HESS, was supplied instead and is folded in) |
| Harmel et al. 2018, RSE 204:308-321 | SWIR sun-glint correction for MSI (GRS) | Obtained; findings folded in |
| Bareuther, Klinge and Buerkert 2020, RS 12:3843 | Bellandur and Varthur cover fractions 2002-2019 | Obtained; per-date table folded into W2, 2.2 and 16.3 |
| Sourav et al. 2024, Environmental Challenges 15:100944 | Buffer built-up figures for B2 | Still to obtain (Bergman et al. 2026, Water, was supplied instead and is folded in) |
| van der Woerd and Wernand 2018, RS 10:180 | MSI tristimulus coefficients for Q7 | Obtained; coefficients recorded (Tables 1 and 2 of the paper) |
| Coffer et al. 2025, IJRS (temporal aggregation) | Compositing recommendations, section 7.7 | Still to obtain (the file supplied was a 2019 tornado-forecasting paper by a different Coffer) |
| Goodrich, Schaeffer et al. 2026, IJRS (review of 122 S2 chl-a studies) | Validation-quality framing for section 10 | Paywalled |
| Caroni et al. 2025, JWCC 16:3372 | Monsoon lag for P9 | Open |
| Ramachandra et al. 2017, ENVIS TR 116 (full) | Nutrient loads and hyacinth cover for S6 | Still to obtain (TR 134 on Agara-Bellandur violations was supplied instead and is folded into B2, N4, S3) |
| Ramachandra, Sincy and Asulabha 2020, Green Chemistry and Technology Letters 6(1) | The 40-lake survey behind V5 | Obtained; the "10%" is 4 of 40 lakes in good condition after restoration, not an improvement count |
| CPCB Guidelines for Water Quality Monitoring, 2017 edition | Current lake parameter list and frequencies; only a scanned PDF was available | Open, scanned |
| KTCDA, List of Lakes in Bengaluru | Obtained as four custody PDFs on 3 September 2026 (BBMP 201 rows, BDA 5, Forest 4, BMRCL 1); the deck's 188 total is not reproducible from them | Obtained; source URL to record |

## Appendix D. Geometry and sampling behind the resolution tables

All values derived. Circular lake; one-pixel shoreline ring removed; real lakes lose 1.3 to 2 times more to the ring because their perimeter is longer for the same area. "Interior" is the pixel count after the ring.

### D.1 Pixels inside the footprint and ring loss, by lake size and pixel size

| Lake | 0.5 m | 3 m | 10 m | 20 m | 30 m | 300 m |
|---|---|---|---|---|---|---|
| 1 ha | 40,000 px, 2% lost | 1,111 px, 10% | 100 px, 32% | 25 px, 58% | 11 px, 78% | none |
| 2 ha | 80,000, 1% | 2,222, 7% | 200, 23% | 50, 44% | 22, 61% | none |
| 5 ha | 200,000, 1% | 5,556, 5% | 500, 15% | 125, 29% | 56, 42% | none |
| 20 ha | 800,000, 0% | 22,222, 2% | 2,000, 8% | 500, 15% | 222, 22% | 2 px, none interior |
| 50 ha | 2,000,000, 0% | 55,556, 1% | 5,000, 5% | 1,250, 10% | 556, 14% | 6 px, none interior |
| 100 ha | 4,000,000, 0% | 111,111, 1% | 10,000, 4% | 2,500, 7% | 1,111, 10% | 11 px, 2 interior |
| 300 ha | 12,000,000, 0% | 333,333, 1% | 30,000, 2% | 7,500, 4% | 3,333, 6% | 33 px, 16 interior |

### D.2 Standard error of a fraction-affected value (P1) at p = 0.3

Binomial standard error with an effective sample of one quarter of the interior pixels, on the assumption that neighbouring pixels are correlated over a range of about two pixels. Values in percentage points.

| Lake | 3 m | 10 m | 20 m | 30 m |
|---|---|---|---|---|
| 2 ha | 2.0 | 7.4 | 17.3 | 31.2 |
| 5 ha | 1.3 | 4.5 | 9.7 | 16.1 |
| 20 ha | 0.6 | 2.1 | 4.5 | 7.0 |
| 50 ha | 0.4 | 1.3 | 2.7 | 4.2 |
| 300 ha | 0.2 | 0.5 | 1.1 | 1.6 |

### D.3 Share of a lake within 100 m of its shore (adjacency exposure, independent of pixel size)

| Lake | Radius | Within 100 m of shore |
|---|---|---|
| 2 ha | 80 m | 100% |
| 5 ha | 126 m | 96% |
| 20 ha | 252 m | 64% |
| 50 ha | 399 m | 44% |
| 100 ha | 564 m | 32% |
| 300 ha | 977 m | 19% |

### D.4 Percentile-rank standard error behind P7

Standard error of the rank of the 90th percentile from n same-season baseline observations, binomial: n = 10, 9.5 points; n = 30, 5.5; n = 100, 3.0; n = 300, 1.7. Three seasons of Sentinel-2 dry-season passes over Bengaluru give on the order of 30 to 60 clear observations, so P7 thresholds carry about 4 to 6 points of error until the archive lengthens.

### D.5 Onset-date error behind P5

Half the median gap between clear passes in the window. Sentinel-2 acquisitions over Bengaluru are 2.3 days apart on average (section 6.2); dry-season clear gaps of 4 to 7 days give plus or minus 2 to 4 days. Landsat 8 and 9 at 8 days give plus or minus 4 days at best. A daily 3 m constellation gives plus or minus 1 day when clear. In the monsoon no optical onset is reported.
