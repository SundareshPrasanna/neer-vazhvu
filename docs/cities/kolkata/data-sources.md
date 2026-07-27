# Data Sources - Kolkata

> Where each Kolkata dataset comes from, how often it refreshes, and what to watch out for.

Kolkata is the sixth onboarded place and the second modelled as a **region** rather than a city. The
scope decision is physical, not administrative: the East Kolkata Wetlands treat 65% of the city's
sewage and lie **outside** KMC, in North and South 24 Parganas. A KMC-only Kolkata would draw a
boundary excluding the city's largest piece of water infrastructure.

Its data landscape is the mirror image of every previous city. Kolkata is **structurally weak on
everything supply-side** (there is no impounded storage to measure, no published abstraction series,
no NRW figure) and **stronger than any city on the platform on the pollution and drainage spine**
(a 12-year quarterly water-quality series with tidal station pairs, a live ward-attributed
waterlogging register, and a full sewage balance in the corporation's own statutory filing).

Absence claims follow the Madurai hedging rule: "no known public X".

## The hero: drainage design standard vs measured rainfall intensity

| | |
|---|---|
| **Standard** | KMC, *Sewerage and Drainage* (`kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf`, PDF creation date 19 Dec 2009). Verbatim: the main sewer network "was designed to discharge a rainfall of **6 mm. per hour**" |
| **Rainfall** | Open-Meteo archive API, **hourly** precipitation (ERA5-family reanalysis, CC BY 4.0). This is a new ingest: every previous rainfall product on the platform is a monthly or daily total, which is the wrong unit for drainage |
| **Method** | `neer-vazhvu-api/scripts/fetch_rainfall_intensity.py` precomputes an exceedance ladder (hours + distinct days above each of 10 candidate thresholds, per year) so the hero's slider moves without shipping ~230k hourly values |
| **Result** | 2000-2025, 232,896 hours. At 6 mm/h: long-run mean **31.8 hours/year** across 21.6 days. **2000-2012 averaged 19.2 h/yr; 2013-2025 averaged 44.5** |
| **Wettest hour** | **40.2 mm** on 22 Jul 2017, 6.7x the design standard |
| **Feeds** | `public/data/rainfall-intensity-kolkata.json` (30 KB), `heroMode: 'drainage-capacity'` |

**Two caveats carried on the face of the hero, not in a tooltip:**

1. **Reanalysis under-reports what this measure is about.** ERA5-family products smooth short
   convective bursts, so every exceedance count is a **lower bound**, not a rain-gauge reading. Where
   a city has in-situ sub-daily gauges these supersede the model. Kolkata has no such public network
   found in this pass; Hyderabad's 185 TGDPS stations are the contrast case.
2. **The 6 mm/hour figure governs the British-era brick trunk network, not every drain in the
   city.** KMC scopes it in the same sentence it states it: *"The main sewer network / brick sewer
   was laid at time of British Regime and it was designed to discharge a rainfall of 6 mm. per
   hour."* The hero says `Kolkata's main brick sewers were built to carry...` for that reason, via
   `drainageCapacity.standardAppliesTo`. KMC publishes no design standard for the areas added
   since, so the chart is a statement about the core city.

   **This resolved a pre-publication gate, and not in the direction it was set.** The gate asked
   whether post-KEIIP rehabilitated stretches carry a different rating, and assumed a KEIIP DPR
   would settle it. Re-reading the citation in full (2026-07-27) showed the conflict was between
   the source and *our paraphrase of it*, not between two sources: KMC never claimed the 6 mm/h
   for the whole city. There was nothing for a DPR to adjudicate. What a future DPR would add is a
   standard for the **new** sewers - a second number to show beside this one, not a correction to
   it. Registered in Headwaters against `keiip.in`.

   Re-verified 2026-07-27: the document still serves HTTP 200 from kmcgov.in with the sentence
   intact. PDF creation date 19 Dec 2009; latest internal date 15/07/2009. Sixteen years old and
   still KMC's current public description of its own drainage, which is itself part of the
   finding. The standard lives in config (`drainageCapacity.standardMmPerHour`), so a revision is
   a one-line edit and a re-cited source, not a code change.

**Independent check.** The modelled exceedance and the KMC waterlogging register below are different
kinds of evidence. One says the sky beat the standard; the other says which streets KMC actually sent
machines to. The product carries both rather than letting one stand in for the other.

## Waterlogging register - KMC weekly (live, ward-attributed)

| | |
|---|---|
| **Source** | KMC Sewerage & Drainage Department, Mechanical Sewer Cleansing wing, *Weekly Drainage Activity Chart* (`kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf`) |
| **Method** | `neer-vazhvu-api/scripts/scrape_kmc_drainage_register.py`, weekly via `.github/workflows/kmc-drainage-refresh.yml` (Mondays 10:15 IST, Sunday catch-up) |
| **Coverage** | 2026-07-20 edition: **329 rows, 66 distinct waterlogging pockets, 53 wards, 15 boroughs, 469 machine deployments** |
| **Structure** | Date, Location/Water Logging Pockets, **Br./Wd** (borough/ward), 5 machine columns, Remarks - so every named pocket carries a ward attribution |
| **Feeds** | `public/data/kolkata-waterlogging-register.json` |

**Gotchas, all learned from the real document:**
- **KMC overwrites this file in place every week. There is no upstream archive.** A missed week is
  permanently lost from the public record, which makes the weekly job the only thing building a
  Kolkata waterlogging time series and makes a stale-by-Monday alert load-bearing.
- The Date cell is **vertically centred** across its group, so pdftotext emits it on whichever row it
  aligns with. The first group's opening row therefore sits *above* its own date and is back-filled.
- Ward cells vary in form within one file: `I/4`, `I/3,4,5`, `III/31 & 32`, `I/ 7`, `XIII / 120`. One
  row can touch several wards.
- Locations wrap onto a second line and are re-joined.
- Division headers appear only on page 1 in the text layer, so division is null for most rows. We do
  **not** infer it from the borough.
- Rows are **de-silting deployments**: where KMC sent machines, not a complete list of where the city
  flooded. That distinction is stated in the artefact.

## Sewage balance - KMC's own District Environment Plan 2021

| | |
|---|---|
| **Source** | KMC, *District Environment Plan 2021 - Kolkata* (`kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf`, 33 pp, PDF creation date 1 Dec 2021), filed under the NGT-mandated DEP process |
| **Method** | `neer-vazhvu-api/scripts/build_kolkata_sewage_balance.py` |
| **Feeds** | `public/data/kolkata-sewage-balance.json`, `public/data/commitments-kolkata.json` |

| Item | Value |
|---|---|
| Total sewage generated | 1,400 MLD |
| **Treated in the East Kolkata Wetlands fisheries** | **910 MLD (65%)** |
| Treated in the existing 5 STPs | 179 MLD |
| Total treatment capacity | 1,089 MLD |
| Untreated or partially treated | 311 MLD (22.21%) |
| Sewage flowing into lakes | 00 |

**910 against 179 means the wetlands do 5.1x what all five sewage treatment plants manage combined.**
By the corporation's own accounting, the principal sewage treatment infrastructure of a
4.5-million-person city is a wetland: unbuilt, unpaid for, under real-estate pressure, and outside
the corporation's boundary.

**Upcoming STPs: 10 plants, 280.06 MLD, 9 with coordinates** (so they map directly). Even if all are
built, 280.06 MLD of new capacity against 311 MLD currently untreated leaves a residual gap of
30.94 MLD, and that assumes the wetlands keep treating 910 MLD.

**Why transcription rather than a parser.** The STP table is a five-level nested multi-column layout
that pdftotext flattens irrecoverably; a positional parser would fail silently, which is the worst
failure mode for a numbers surface. The table is transcribed with provenance and the script
**validates it against arithmetic the document itself prints** (capacities must sum to KMC's stated
280.06; 910+179 must equal 1,089; 1,400-1,089 must equal 311; 311/1,400 must equal the stated
22.21%). A mistyped figure fails the build.

**Correction to the research note:** the pre-onboarding research recorded 11 upcoming plants. There
are **10**, and they sum exactly to the document's printed 280.06 MLD total.

**Named gap, from the source itself:** KMC's Environment Plan leaves the **entire
industrial-wastewater section blank** - every field empty, WBPCB named as responsible. That is the
corporation declaring a gap in its own statutory plan, and it is surfaced rather than filled.

## Water quality - WBPCB EMIS (BUILT)

| | |
|---|---|
| **Source** | WBPCB EMIS Water Quality Information System, `emis.wbpcb.gov.in/waterquality/showwqprevdatachoosedist.do` - plain HTTP, **no login** |
| **Method** | `neer-vazhvu-api/scripts/scrape_wbpcb_emis.py`, districts 013 (Kolkata) + 001 (N24P, for Palta) |
| **Result** | **41 stations, 3,209 samples, 2010-2026.** Longest series: Ganga at Dakshineswar, **281 samples**, 2010-01-28 to 2026-07-07 |
| **Feeds** | `public/data/river-quality-kolkata.json` |

**Parsing gotchas, all found against live data:**
- WBPCB spells the same station **both "Adi Ganga" and "Adi ganga" in its own station list**, which
  split three of the six tidal pairs into six single-phase stations and destroyed exactly the
  comparison this dataset exists for. Canonical-name rules collapse them.
- Route by the portal's **own kind label** ("River-", "Ground Water-", "Lake-"), not by station name.
  Guessing from the name put groundwater wells in with rivers, and groundwater samples carry no DO or
  BOD at all - two different parameter sets silently blended.
- **"NIL" dissolved oxygen is stored as 0.0, not null.** It is a real measurement and the single most
  important reading in the dataset; nulling it would erase the finding.
- WBPCB publishes **no coordinates**. 15 stations are hand-placed from their names against the mapped
  channel and flagged `coords_approximate`; the other 26 are kept in `unmapped_stations` with their
  full series rather than dropped or given invented positions.
- Some older samples are permanently unservable; the retry policy fails fast rather than stalling.

**The tidal finding, which no other city's data supports:** low tide is consistently worse than high.
At Bansdroni on the same day, BOD 14.53 against 10.75 and faecal coliform 8.4 million against 4.9
million - less dilution, more concentration.

The citizen path needs no login, but the `/waterquality/` **root is** a login page: do not generalise
the block from a sibling path. Three-step Struts flow:

1. `POST /waterquality/showwqprevdata.do` with `viewdistcode` + `station_types` (`R` river & ground
   water, `M` marine, `D` channels, `I` idol immersion) -> station list
2. `POST /waterquality/viewsampledatacitizen.do` with `viewstncode` -> dated sample list
3. `GET /waterquality/wq/sampdetailReport.do?samp_id=<id>&stn_type=R` -> full analysis

District codes (verified): 001 = 24 Parganas(N), 002 = 24 Parganas(S), 010 = Hooghly, 011 = Howrah,
**013 = Kolkata**, 018 = Nadia.

Kolkata's 28 stations include the **Adi Ganga at six points** - Bansdroni, Jirat Bridge, Kalighat,
Karunamoyee, Kudghat, Sahid Kshudiram - **each sampled separately at HIGH TIDE and LOW TIDE**. The
high/low-tide pairing is unique on the platform and is the correct way to model a tidal river; it
argues for a shared `tidalPhase` dimension on river stations rather than a Kolkata-only field.
24 Parganas(N) carries **Ganga at Palta**, Kolkata's own intake, so raw-water quality at the intake is
observable even though abstraction volume is not. Depth is ~50 samples per station, 2014 to 2026.

The finding this unlocks, verified in the research pass: the **Adi Ganga at Bansdroni recorded zero
dissolved oxygen and 4,900,000 MPN/100 ml faecal coliform on 7 May 2026**, with WBPCB's own observers
recording the water as "Blackish" and "Pungent".

## Supply - run-of-river, and a total we will not publish

Source: `kmc-wd.com` - carrying two caveats the page itself displays: it is labelled **"(DRAFT)"**,
its footer reads **"(c) 2013"**, and it refers to 1,900 MLD "in 2025" in the future tense.

| Plant | Design capacity |
|---|---|
| Indira Gandhi WTP (Palta, Barrackpore) | 1,180 MLD |
| Garden Reach Water Works | 839.4 MLD |
| Jai Hind Jal Prokolpo (Dhapa) | 136.3 MLD |
| Jorabagan | 36.3 MLD |
| Watgunge | 22.7 MLD |
| Deep tube wells | ~110 MLD |

**Flagged inconsistency - do not launder.** Those plants sum to 2,214.7 MLD plus ~110 MLD of tube
wells = 2,324.7 MLD, yet the same page describes a *target* of ~1,900 MLD generation in 2025 and a
requirement of ~1,660 MLD. Either the plant figures are post-expansion design capacities rather than
current output, or the page mixes vintages. **No total-capacity number appears anywhere in the
product until this is reconciled** against KMC's budget statements (OpenCity `kmc-budget-statement`,
16 PDFs). Per-plant figures are carried as design capacities and never summed.

**There is no impounded storage anywhere in that list.** Supply is Hooghly abstraction plus tube
wells, which is why `days-left` is not merely awkward for Kolkata but undefined: the numerator does
not exist.

**Bulk sales** (ready-made Allocation Ledger rows, and the reason Bidhannagar and Budge Budge are in
scope at all): 90 MLD to Bidhannagar Municipal Corporation, 22.7 MLD to Budge Budge Municipality.

## Groundwater

**This inverts the assumption the research pass started with.** A full India-WRIS station census
(2010-01-01 to 2026-07-25, paged to exhaustion) finds **23 stations in Kolkata district and 667
across the six KMA districts**, live to 2026-06-04 - denser than Delhi's 237-station network, which
was enough to carry a per-ward card.

| District | Stations | Rows | Latest reading |
|---|---|---|---|
| Kolkata | 23 | 10,593 | 2026-06-04 |
| North 24 Parganas | 212 | 50,314 | 2026-06-04 |
| South 24 Parganas | 188 | 38,454 | 2026-05-21 |
| Nadia | 183 | 72,000+ | 2026-06-04 |
| Howrah | 58 | 1,112 | **2023-04-30 (gone quiet)** |
| Hooghly | 3 | 12 | **2022-11-30 (effectively dead)** |

Howrah and Hooghly must render as **stale**, not be interpolated over. Count is not coverage: confirm
spatial spread before painting a continuous surface. Per-ward depth stays off in `groundwaterViews`.

**A trap worth recording:** a too-narrow date window is indistinguishable from "no stations". A
2024-25 window reported 3 groundwater stations in Kolkata district; the full 2010-2026 census found
23. Probe wide, then narrow.

**"Groundwater polluted areas: NIL"** is what KMC's own Environment Plan states. Given West Bengal's
arsenic situation that is contestable, but Kolkata *district* is not among the worst-affected. **Do
not present it as a contradiction without district-level arsenic evidence.**

## Arsenic (KMA scale)

Primary-grade: British Geological Survey / ADB, *Arsenic and Fluoride in Drinking Water in West
Bengal* (`adb.org/sites/default/files/linked-documents/49107-006-sd-01.pdf`, 40 pp, 7 Aug 2018),
built on **West Bengal PHED's IMIS, valid as of 30 April 2016**.

West Bengal holds **69% of India's arsenic-affected population**. North 24 Parganas is **42.4%
affected** (2,699 of 7,334 habitations). Of 47,062 samples tested across 22 blocks there, 8,609
(18.3%) exceeded 10 ug/L. Affected blocks land on **Barrackpur I and II** (the intake), and
**Rajarhat** (the development front) - which independently confirms the region scope.

**Open item before publication:** the underlying data is valid as of 2016. Find PHED IMIS directly or
JJM-WQMIS (`ejalshakti.gov.in/WQMIS`) for a current source.

## Rivers, water bodies, drainage, localities - OpenStreetMap

| | |
|---|---|
| **Method** | `scripts/fetch-osm-layers.ts --city kolkata --layer all` (city-generic, replaces the per-city clone pattern) |
| **Result** | 5,526 water bodies (5,365 ha), 4 dissolved rivers (Hooghly 140 km, Saraswati 67, Adi Ganga 39, Bidyadhari 38), 182 drain segments, 765 localities (237 with Bengali names) |

**Two bugs worth recording, both of the silent-wrongness kind:**
- The first pull made **the Hooghly the largest "water body" in Kolkata**: 16 `water=river` polygons
  carrying 1,828 ha came back tagged `natural=water`, three larger than any genuine lake. Standing-water
  kinds now pass an explicit **allowlist**, so an unknown future OSM value defaults to excluded.
- **Rabindra Sarobar and Subhash Sarobar were missing entirely.** Both are OSM *relations*, not ways,
  and a ways-only pass dropped the city's two most significant named lakes - both WBPCB-sampled.
  Multipolygon assembly added; 24 relations recovered. Note OSM spells them "Sarobar", not "Sarovar".

**Caveat:** OSM's extent is conservative for some features. Its outer ring for Rabindra Sarobar is
3.04 ha against a lake usually given as ~29 ha. This layer corroborates KMC's 1993 list; it does not
replace it.

## Groundwater stations - India-WRIS (BUILT)

| | |
|---|---|
| **Method** | `neer-vazhvu-api/scripts/build_cgwb_stations.py --city kolkata --kma` |
| **Result** | **703 stations, 201,221 readings**, 2010-2026, six KMA districts |
| **Feeds** | `public/data/kolkata-cgwb-stations.json` |

**Three traps, each of which produced a plausible-but-wrong network rather than an error:**
1. **Paging.** Kolkata reads as 3 stations over 2024-2025, and still 3 over 2010-2026 if you stop at
   page 0 - the first page is monopolised by a couple of high-frequency telemetric wells. Paged to
   exhaustion it is 23.
2. **Sign convention, per station not global.** Manual wells report depth below ground as positive
   metres; telemetric piezometers report it as negative. Kolkata's only two live wells (Jadavpur_1,
   Salt Lake Pz_1) report -22.06 to -8.70 m, so a naive `v < 0` reject dropped all 9,115 of their
   post-2024 readings and **the city reported stale since May 2023 when it is live to June 2026.**
   52 stations flipped.
3. **Metadata from the latest row.** WRIS leaves lat/lng null on many individual readings, so keying
   coordinates off a station's most recent row deleted whole stations - **Nadia collapsed from 205 to
   39**, and what remained still looked like a plausible network.

## Groundwater assessment - IN-GRES (BUILT)

| | |
|---|---|
| **Source** | IN-GRES, India Ground Water Resource Estimation System (CGWB + state GW departments), `ingres.iith.ac.in`. IIT-Hyderabad hosted, so **outside the NICNET gate** that blocks CPCB and CGWA |
| **Method** | `neer-vazhvu-api/scripts/build_ingres_gwr.py --city kolkata`, via `POST /api/gec/getBusinessDataForUserOpen` (no auth) |
| **Result** | 4 assessment years (2021-22 to 2024-25), all 6 KMA districts |
| **Feeds** | `public/data/gwr-blocks-kolkata.json` |

**THE FINDING: Kolkata district is not assessed on extraction at all.** It is categorised
**`salinity`** - a poor-quality category, not a safe/semi-critical/critical/over-exploited stage band
- and carries no availability, resource or extraction figures, because CGWB does not assess saline
aquifers on extraction. South 24 Parganas is the same. So the exploitation choropleth Chennai has
cannot be drawn for Kolkata district: the framework classifies it on a different axis. That is a
finding rather than a missing file, and it is a third distinct way Kolkata refuses the standard
framing, after "no storage to run down" and "no dam to release".

The surrounding ring **is** assessed, so the regional picture is real: **North 24 Parganas moved from
safe to semi-critical in 2024-25** - the district holding both Palta, Kolkata's intake, and the
arsenic belt - with Nadia semi-critical and Hooghly and Howrah safe.

**Payload gotchas (two prior sessions to solve, do not "simplify"):** keys are lowercase, not
camelCase; `locname` has **no spaces** ("WESTBENGAL"); `view` is lowercase `"admin"`; `parentuuid` is
**required** and is the discriminator - without it the server returns a well-formed response
containing only an empty `total` row, which reads as "no data for this state" rather than an error.
State UUIDs come from the Angular bundle's `STATEUUIDLAYERNAME` constant (West Bengal =
`68ecabb4-0ea5-4909-b8e3-20bbaa7b91e8`).

**Naming gotcha:** IN-GRES spells them **KOLKATTA, HAORA, HUGLI**; India-WRIS spells the same
districts KOLKATA, HOWRAH, HOOGHLY. Two government portals do not agree on district names, so
spellings are enumerated empirically per portal.

## Wards

**141 of 144.** OpenCity's "Kolkata Wards Map 2022" KML carries ward numbers 1-141; **142, 143 and 144
are absent**, and the only attribute is `WARD` (a bare number) - **no ward name, no borough**. The 144
count is primary-confirmed from KMC's own Environment Plan.

`my-ward` and all ward surfaces stay **off** until the three missing wards are recovered and a
name/borough join is built. A partial ward layer that silently drops three wards is worse than none.

**What we know about them anyway.** KMC-SHARP's IEE places wards **142 and 143 in Borough XVI**,
created in **2012** (not the 2015 Joka additions previously assumed), with ~573 ha of Ward 142
spread across two catchments draining via the **Keorapukur canal into Tolly Nullah - the Adi
Ganga**. So they are unmapped, not unknown. It is enough to attribute them in prose, and not
enough to draw them.

### Routes tried, and why each fails (re-run 2026-07-27, with kmcgov.in back up)

The first exhaustion pass ran while KMC's site was down, so it was re-run once the site returned.
Two new candidates appeared and both are empty:

| Route | Result |
|---|---|
| OpenCity "Kolkata Wards Map 2022" KML | 141 wards. The only public ward geometry that exists |
| OpenStreetMap | Maps **no** Kolkata ward boundaries at all, for any ward |
| `kmcgov.in` → `WardwiseSmartMap.jsp` | **Page exists, content does not.** Renders nav chrome and an "Ward Wise Smart Map" heading over an empty body. Footer still reads "@ 2009" |
| `kmcgov.in` → `DrainageNetworkMap.jsp` | Same stub, byte-identical link set |
| `kmc.wb.gov.in` (the newer DIGIT/eGov citizen portal) | Service-delivery stack - property tax, water/drainage billing, grievances. Google Maps for pin-drops; **zero** occurrences of geojson/kml/leaflet/geoserver/wfs in its 9.9 MB bundle |
| `kmc.wb.gov.in/egov-location/.../boundarys/_search` | Live endpoint, `200 OK`, and returns **`TenantBoundary: []`** for every tenant/boundaryType tried |

**The finding is broader than three wards.** KMC publishes no ward geometry through *either* of its
portals - the boundary service holds nothing for ward 1 any more than for ward 142. The OpenCity
KML is not one source among several that happens to be short by three; it is the only one there is.
That reframes the gap: it will not close by finding a better KMC endpoint, only by someone
digitising the 2012 delimitation. Registered in Headwaters as a watch on the OpenCity KML.

## The contested denominator

KMC's Environment Plan gives area 206.08 km², population "more than 4.5 million", **floating
population 60,00,000 per day**, density 24,252/km², 16 boroughs, 144 wards, 1,056,351 households
(2011 Census). Meanwhile KMC's water-distribution site frames demand off a **"static population" of
44.96 lakh**.

**The corporation contests its own denominator.** `defaultConsumptionMld` is therefore `null`: every
LPCD figure for Kolkata is unstable at the source and we will not manufacture one. This is a
first-class honest-gap card, and it is unusual - most cities hide this, KMC published both halves.

## Water bodies

KMC's inventory is a **departmental tank list "as prepared on 1993"** plus an NRSA aerial map from
2004, covering 3,777 lakes/ponds. A 33-year-old inventory is a named gap and a strong argument for the
satellite water-body pipeline as the corroborating layer.

## Named gaps

- **NRW: not found at all.** Combined with near-absent domestic volumetric charging and largely
  unmetered connections, Kolkata's governance story is that water is close to free and almost
  entirely unmeasured, which makes non-revenue water and distributional equity structurally
  invisible.
- **Current tariff schedule.** The one in hand is **2010-11** (`kmcgov.in/KMCPortal/downloads/
  WaterSupplyDepartment.pdf`): KMC runs a municipal tanker service at Rs 450/trip for 3,600-4,000 l
  within 8 km. No volume data is published.
- **KMA structure.** The 3-vs-4 municipal-corporation discrepancy is unresolved; KMDA's site did not
  yield figures and its certificate has a hostname mismatch. This is why the region models only
  units with individually verified water relationships, and the remaining ~38 municipalities are a
  stated gap rather than a silent omission.
- **Land subsidence.** Real, with InSAR literature, but not researched to primary.
- **Bantala tannery complex / CETP.** Not researched; WBPCB samples groundwater *inside* the Kolkata
  Leather Complex, so a hook exists.
- **Bengali UI.** `availableLanguages: ['en']` with `upcomingLanguages: ['bn']`. The drainage-hero
  strings are English-only in `translations.ts`; entries are partial by design and fall back to `en`,
  so the Bengali toggle renders them in English until a native review pass.

## Retired / rejected

- **India-WRIS district-name legacy set.** Not Kolkata-specific but recorded here: WRIS district
  vocabularies can be pre-reorganisation. A new place must enumerate district spellings empirically
  rather than assume current names resolve.
- **CPCB** is IP-blocked from this network (as for Delhi); anything CPCB-sourced must route via the
  India-IP runner, never CI.
