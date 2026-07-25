# Pan-India Source Playbook

> Reusable, city-agnostic data sources and acquisition recipes, so onboarding a new city or district starts from here instead of from scratch. Every entry was proven in a real onboarding (city named). Add entries only after an acquisition has actually worked; record the failure modes too.
>
> Started 2026-07-24 during Delhi onboarding. Companion to the per-city `docs/cities/<city>/data-sources.md` files (which record what a specific city USES; this file records what any city CAN use).

## Groundwater assessments: IN-GRES (standing decision)

**Owner directive (2026-07-24): IN-GRES is the source for groundwater-assessment data for every current and future city. Do not re-research this per city.**

| | |
|---|---|
| Portal | https://ingres.iith.ac.in - India Ground Water Resource Estimation System, the official CGWB + state-departments system behind every "Dynamic Ground Water Resources" report |
| Why it wins | Hosted at IIT Hyderabad → **outside NICNET**, reachable from any network (unlike CGWA); every assessment year; every admin level (country → state → district → tehsil/block/mandal/taluk/firka); GIS layers included |
| Scope boundary | IN-GRES answers *how much is extracted against what is available*, per admin unit. It does **not** give depth-to-water. For measured water levels use the India-WRIS observation-well API below - the two are complementary, not alternatives |
| Year semantics | Portal labels are hydrological data years ("2023-2024") = report-edition END year ("2024" compilation). Assessments are ANNUAL since 2022. **Watch unit changes**: many states switched assessment units over time (Delhi: tehsils ~34 → districts 12 in 2022; TN: firka → block per the Madurai gotcha) - series across a unit change must not be stitched naively |
| Getting a location UUID | Open the portal UI, navigate to the state/district, and read the address bar - the Angular route embeds `locuuid=<uuid>` (e.g. Delhi STATE = `a1ac5d18-8c9a-4047-8fdd-4d7d9deaa34e`). No API enumeration needed |
| API base | `https://ingres.iith.ac.in/api/` - no-auth endpoints observed: `gec/getBusinessDataForUserOpen`, `gec/getGISComparisonDataOpen`, `gec/stateHieAndAssmntData`, `gec/mapBusinessData`, `locations/heirarchy` |
| Param vocabulary | `view=ADMIN`, `computationType=normal`, `component=recharge`, `period=annual`, `category=safe`, `verificationStatus=1` (VERIFIED_REPORT), `approvalLevel=1` (non-login) |
| Open item | The exact browser POST body still needs one DevTools "Copy as cURL" capture (our replays return an empty total row). Then write `neer-vazhvu-api/scripts/fetch_ingres_gwr.py` (state-uuid + year → unit table) and every city's GWR layer uses it |
| Interim mirror | OpenCity hosts per-edition national-compilation datasets with per-state CSV cuts (IN-GRES exports) - Delhi's district layer currently builds from these (`build_delhi_gwr_blocks.py`); 2022-23 edition is NOT mirrored there |
| Proven in | Delhi (district choropleth + 3-year trend, 2026-07) |

## Groundwater LEVELS: India-WRIS observation-well API (standing recipe)

**Use this for measured depth-to-water anywhere in India. It replaces per-city Year-Book PDF transcription (the slow path used for Madurai and Mumbai).**

| | |
|---|---|
| Endpoint | `POST https://indiawris.gov.in/Dataset/Ground%20Water%20Level?<query params>` |
| Reachability | **Works from a non-India IP.** The older note that "WRIS is India-IP gated" was wrong for this endpoint and cost Delhi a whole feature. Probe before assuming a block |
| Params (ALL mandatory) | `stateName`, `districtName`, `agencyName`, `startdate`, `enddate`, `download`, `page`, `size` |
| **The trap** | Params go in the **query string, not a JSON body** (a JSON body returns `400 Required String parameter 'stateName' is not present`). And a **blank `districtName` or `agencyName` returns zero rows, not all rows** - which reads exactly like "no data exists for this city". Always iterate districts explicitly, and pin `agencyName=CGWB` |
| Discovery trick | Send the request with params missing one at a time: the 400 body names the next required param, so the contract can be walked out in a few calls |
| Pagination | `page=0,1,2...` at `size=9000` until a short page. Verified non-overlapping |
| Returns | `stationCode`, `stationName`, `latitude`, `longitude`, `district`, `tehsil`, `agencyName`, `dataAcquisitionMode` (Telemetric/manual), `stationStatus`, `dataValue`, `dataTime`, `unit` |
| Depth | Later years are 6-hourly telemetric (DWLR); earlier years are periodic manual readings. Delhi: 237 stations, 278,830 readings for 2015-2025 |
| **SIGN CONVENTION - read this** | `dataValue` sign depends on the installing programme, and a single state mixes families. Delhi carries three: numeric lat/long-encoded NHN codes and `AAXI*` are **positive-down**; `CGWBDL*` is **negative-down**. **Never `abs()`**: it erases genuine water-above-datum readings in floodplain wells and it launders sign-faulty sensors into plausible data. Derive the convention **per station** from the median of its own readings, then assert that stations of the same code family agree |
| Sanity gate | Reject readings outside a physically defensible depth envelope and report what was dropped. Delhi used -5..100 m and caught two dead sensors (one emitting symmetric ±26.10 m, one emitting 660-890 m) |
| Cross-check | Verify against known hydrogeology before trusting the transform. Delhi's ridge wells (Gadaipur, Sultanpur ~68 m) vs floodplain wells (Jagatpur, Coronation Pillar ~2 m) reproduced the published over-exploited districts |
| Liveness | Do **not** assume live. Delhi's telemetry stops 2025-09-20 across the whole network |
| Script | `neer-vazhvu-api/scripts/build_delhi_cgwb_stations.py` - copy per city; caches raw rows to `.cache/` so re-runs skip the ~40 min download |
| Proven in | Delhi (237 wells → station overlay, per-ward groundwater card, and the `risk_v2_dl` composite, 2026-07) |

## Informal settlements / slum rosters

- Housing-board rosters often publish **names and coordinates in two different PDFs** with **different serial numbering**, so they must be joined on normalised location text, not on serial. Delhi: DUSIB's 675 JJ bastis - roster with households in one PDF (2019), lat/long in another (2022), both linked from the same page. Record `match_method` (exact/fuzzy/unmatched) per row and leave low-confidence rows unjoined rather than guessing.
- Long location names wrap across up to three physical lines in `pdftotext -layout` output, with the coordinates landing on continuation lines. Parse a record as a **block anchored on a strictly sequential serial**, then recover coordinates from anywhere inside the block by numeric range. Naive per-line regex silently lost 137 of 675 rows.
- Expect legitimate out-of-jurisdiction points: 33 of Delhi's 675 fall in NDMC or the Cantonment Board, which are outside the municipal ward set. Count them as out-of-jurisdiction, never drop them silently.

## Urban open-data: OpenCity CKAN (+ the delisting recovery recipe)

- Portal https://data.opencity.in is a full CKAN: use the API, not the UI - `api/3/action/package_search?q=...`, `package_show?id=<slug>` for resource URLs. Proven across Chennai, Delhi, and the national GWR mirrors.
- **Datasets get DELISTED without notice** (Delhi wards, DJB pipeline KMLs). Recovery recipe, in order: (1) CKAN `package_show` on the remembered slug; (2) Wayback CDX on `data.opencity.in/dataset/<uuid>/resource/*` - **but Wayback truncates large payloads at MiB boundaries** (both Delhi ward captures were cut; check `length` and the closing tag before trusting); (3) local copies - check `~/Downloads` and project archives, and verify identity byte-wise against the truncated Wayback capture (that check made the recovered Delhi wards citable); (4) email OpenCity (DataMeet/Oorvani ecosystem, responsive).
- District/village/pincode boundary KMLs exist for many states under generic datasets (`district-maps-for-states-of-india`, `villages-maps-of-delhi`, ...). Watch spelling drift in KML attributes (Delhi's "SHAHADRA").

## Ward/admin boundaries

1. First stop: OpenCity + Datameet (`github.com/datameet/Municipal_Spatial_Data`, `datameet/maps`) - **but check the delimitation vintage against the CURRENT one before ingesting** (Datameet Delhi = pre-2022 290 wards; HT Labs = 2017; both useless for 2022+ joins).
2. State Election Commission per-ward PDF maps always exist and are the traceable-of-last-resort (HT Labs proved QGIS tracing works).
3. State GIS portals (KSRSAC, TNGIS, GSDL...) and ESRI India policymaps hubs are erratic - items go inaccessible; treat as bonus, not plan.
4. Election-results CSVs (TCPD-schema) for councillor/reservation data live on OpenCity per city; winner rows validate the geometry join (Delhi: 250/250, zero name mismatches).

## OSM / Overpass recipes

- Endpoints: overpass-api.de + overpass.kumi.systems (mirror); both rate-limit and 504 under load - scripts must take `OVERPASS_URL` env override and expect retry-later.
- Water bodies: `natural=water` + `water~lake|reservoir|pond|tank` + `landuse=reservoir`, EXCLUDE `water=drain|wastewater` (Chennai/Bangalore/Madurai/Mumbai/Delhi pattern, osmtogeojson assembly).
- Drains as their own layer: `waterway=drain` (exclude `ditch`) - honest floor where no official drain GIS exists (Delhi: ~487 of the DMP's 3,737 km).
- Rivers: name-regex + connectivity walk; channels switch `river/canal/drain` tags along their course (per-channel accepted-tag sets); **beware name-collision false-matches** (Delhi's "Eastern Yamuna Canal" rendered a phantom second Yamuna).
- Localities: `place~suburb|neighbourhood|quarter|village|hamlet` + ward point-in-polygon join. Wards missing OSM coverage in outer/rural areas is normal.
- Admin levels are NOT reliable for wards (Delhi level 9/10 = sectors/villages, no MCD wards).

## National feeds with per-city legs

- **IMD gridded rainfall** (imdlib, 0.25°) + **NASA POWER** + **Open-Meteo**: add the city centroid, done - existing multi-city pipelines.
- **CWC**: weekly reservoir bulletin PDF (multi-state parser exists); FFS gauges (ffs.india-water.gov.in) for flood pages; historical flood case-studies as citable PDFs. **Verify what a table actually contains before citing (the Delhi 2023 case study's historical table is DISCHARGES, not gauge levels).**
- **State PCB monthly analysis reports**: the DPCC pattern (river + drain + STP/CETP monthlies as scanned PDFs on a Drupal site whose raw HTML lists the files) likely repeats in other PCBs - check `<pcb-domain>/dpcc/analysis-reports`-style pages before assuming absence. PDFs are usually image scans → OCR batch.
- **Jal Dharohar / 1st Water Bodies Census**: per-state KML/CSV cuts on OpenCity; point layer joins onto OSM polygons (expect a large honest-unmatched share - johads and recharge pits aren't in OSM).

## Network constraints (check EARLY in any onboarding)

- **NICNET (164.100.x.x) hosts refuse non-India IPs**: cpcb.nic.in, yamuna-revival.nic.in, arc/wdo.indiawris.gov.in, Bhuvan/NDRF, cgwa-noc.gov.in. Anything on them routes through the India-IP runner (launchd pattern) - plan it into the cron architecture on day 1, and always look for a non-NICNET mirror first (IN-GRES, OpenCity, IIT-hosted portals, PIB).
- **Do not generalise a block from a sibling hostname.** `arc.indiawris.gov.in` (ArcGIS tiles) is blocked, but `indiawris.gov.in/Dataset/*` is **open from any IP** - and treating the whole domain as gated is exactly why Delhi shipped with per-ward groundwater switched off until 2026-07-25. Probe the specific host+path you need, per endpoint.
- Gov domains migrate: `djb.delhigovt.nic.in` → `delhijalboard.delhi.gov.in`; `dpcc.delhigovt.nic.in` → `dpcc.delhi.gov.in`. Probe with redirects on and record the canonical.
- Probe ALL audit URLs with a browser UA before building; news/journal 403s are bot-blocks, fine as citations.

## Verification discipline (what Delhi QA taught)

- HTTP 200 is not "renders": client components crash after SSR. Verify visually - headless Chrome (`--headless=new --screenshot --virtual-time-budget=15000`) against the preview server, before claiming a surface works.
- Authored JSON must be shape-compared against the reference city's file AND the consuming component's interface (string-vs-array `earmarked_for`, `{blocks:[...]}` wrappers, enum spellings like "Semi Critical").
- When a page looks empty, hunt a non-blocked data route before declaring a gap (the Delhi groundwater lesson: only the polygon service was blocked; values + district KML were public all along).
