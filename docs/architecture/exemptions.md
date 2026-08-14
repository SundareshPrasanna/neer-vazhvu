# Exemption register

> Every deliberate omission on the platform, in one place. **Generated - do not edit by hand.**
>
> Regenerate: `npx tsx scripts/build-exemptions-register.ts`
> Source of truth: `scripts/lib/exemptions.ts`

This exists because a platform that treats data gaps as first-class has to be able to answer *what are we not showing, and why?* without reading four unrelated files. It is generated from the code that governs each omission, so it cannot drift from behaviour: `npm run data:check` fails if the committed copy is stale, or if any entry has no reason recorded.

| Kind | Entries |
|---|---|
| Suppressed freshness checks | 1 |
| Artifacts with no registered upstream | 76 |
| Routes a city deliberately does not ship | 33 |
| Absences the product states on the page | 20 |
| **Total** | **130** |

**1 of these have no recorded rationale.** They are real, deliberate omissions whose original reason was never written down. They are marked rather than back-filled with a guess, because an invented justification reads as authoritative and is worse than an admitted blank. Each is a TODO: record the real reason, or ship the thing.

- `mumbai` / my-ward

## Suppressed freshness checks

A city skipping a derived staleness check. This is the only kind that suppresses a CI failure, which is why the map is owned by `scripts/lib/exemptions.ts` rather than by the checker. **Empty is the correct steady state.** Every entry should carry the condition that would retire it.

| Scope | Subject | Reason |
|---|---|---|
| gurugram | rainfall-recent | No IMD gridded base series exists for Gurugram yet, and rainfall-recent is the provisional fill on top of one. Retire this by generating imd-rainfall-monthly-gurugram.json and wiring the city into fetch_recent_rainfall.py. |

## Artifacts with no registered upstream

Shipped data with no Headwaters upstream to watch for new editions. Usually correct - a curated compilation, a derived product, or a continuously-edited source with no editions to detect - but each one is a file that will never alert when its source moves. This is the allowlist itself; a few entries are directory prefixes covering many files, so it does not equal the per-artifact count that `check-upstream-editions.ts --validate` reports for coverage.

| Scope | Subject | Reason |
|---|---|---|
| bangalore | public/data/allocations-bangalore.json | claim register; per-arrangement citations in the file's sources map (BWSSB About, JICA appraisal, SC Cauvery verdict, dated press); no watchable listing |
| bangalore | public/data/bangalore-localities.json | curated search index, no upstream |
| bangalore | public/data/bangalore-ward-profiles.json | derived join |
| bangalore | public/data/elevation-bands-bangalore.geojson | covered by the platform-scope entry fabdem-dem |
| bangalore | public/data/imd-rainfall-monthly-bangalore.json | scheduled rebuild: imd-rainfall-refresh.yml (P5-1) |
| bangalore | public/data/industrial-sources-bangalore.json | curated compilation (KSPCB directory via OpenCity, NGT Forward Foundation filings, WELL Labs, IISc CES, press); per-record source fields; no watchable listing |
| bangalore | public/data/rainfall-recent-bangalore.json | daily feed: owned by check-data-freshness.ts |
| bangalore | public/data/restoration-priority-bangalore.json | derived: curated flagship set + scoring |
| bangalore | public/data/river-events-bangalore.json | curated event timeline (court orders + named events); per-record citations; no watchable listing |
| bangalore | public/data/ward-risk-bangalore.json | derived composite (population, water bodies, density) |
| bangalore | public/data/water-bodies-lost-bangalore.json | archival |
| chennai | public/data/chennai-localities.json | curated search index, no upstream |
| chennai | public/data/elevation-bands-chennai.geojson | covered by the platform-scope entry fabdem-dem |
| chennai | public/data/rainfall-recent-chennai.json | daily feed: owned by check-data-freshness.ts |
| chennai | public/geojson/chennai-coastal-hotspots.geojson | closed series: Anagha, Singh & Frappart 2026, single study |
| chennai | public/geojson/chennai-coastal-transects.geojson | our own MNDWI/GEE computation, coastal-shoreline-refresh.yml annual (P5-1) |
| chennai | public/geojson/chennai-coastal-zones.geojson | closed series: Anagha, Singh & Frappart 2026 seed layer; superseded by computed transects |
| chennai | public/geojson/chennai-flood-2020-hotspots.geojson | closed series: Cyclone Nivar Nov 2020 reference layer |
| chennai | public/geojson/chennai-water-bodies-lost.geojson | archival, per-feature sources |
| delhi | public/data/delhi-flood-hotspots.json | curated waterlogging register; per-entry landmark/press citations. The official lists (169 identified locations 2025, 448 traffic-police-mapped points) are referenced in reporting but not published as data - PWD monsoon action plan / RTI is the named gap in the file itself. |
| delhi | public/data/delhi-localities.json | curated search index, no upstream |
| delhi | public/data/delhi-ward-profiles.json | derived join; the ward geometry is watched by opencity-delhi-mcd-wards |
| delhi | public/data/elevation-bands-delhi.geojson | covered by the platform-scope entry fabdem-dem |
| delhi | public/data/imd-rainfall-monthly-delhi.json | scheduled rebuild: imd-rainfall-refresh.yml (P5-1) |
| delhi | public/data/rainfall-recent-delhi.json | daily feed: owned by check-data-freshness.ts |
| delhi | public/data/restoration-priority-delhi.json | derived: flagship scorer over covered inputs |
| delhi | public/data/restoration-projects-delhi.json | curated compilation; per-record citations (NGT/court orders, government documents, press); no watchable listing |
| delhi | public/data/river-events-delhi.json | curated Yamuna timeline; per-record url citations (court orders, instruments, floods); no watchable listing |
| delhi | public/data/ward-risk-delhi.json | derived composite |
| delhi | public/data/water-bodies-flagship-delhi.json | curated flagship register; per-record citations (ASI, DDA, INTACH, press); no watchable listing |
| delhi | public/data/water-bodies-lost-delhi.json | archival |
| delhi | public/geojson/delhi-drainage.geojson | OSM/Overpass: continuously edited, no editions (P5-1). No official Delhi drain GIS is public - the IFC 2018 Drainage Master Plan's 3,737 km across 11 agencies exists only as PDF maps, so these lengths are a floor. |
| hyderabad | public/data/allocations-hyderabad.json | claim register; per-arrangement citations inline; no watchable listing |
| hyderabad | public/data/commitments-hyderabad.json | curated commitment register; per-entry dated citations; no watchable listing |
| hyderabad | public/data/facts-hyderabad.json | hand-compiled; every fact carries its own source_url; no watchable listing |
| hyderabad | public/data/rainfall-recent-hyderabad.json | daily feed: owned by check-data-freshness.ts |
| hyderabad | public/data/restoration-projects-hyderabad.json | curated compilation (HYDRAA, HMDA, MRDCL, dated press); per-record citations; no watchable listing |
| kolkata | public/data/facts-kolkata.json | derived: compiled from sources already covered upstream |
| kolkata | public/data/rainfall-recent-kolkata.json | daily feed: owned by check-data-freshness.ts |
| kolkata | public/data/restoration-projects-kolkata.json | curated compilation from named court/news sources, graded per entry |
| kolkata | public/data/water-bodies-flagship-kolkata.json | curated compilation, graded V/N/C per entry |
| madurai | public/data/elevation-bands-madurai.geojson | covered by the platform-scope entry fabdem-dem |
| madurai | public/data/gee-phase1-water-body-targets-madurai.json | our own GEE target manifest |
| madurai | public/data/imd-rainfall-monthly-madurai.json | scheduled rebuild: imd-rainfall-refresh.yml (P5-1) |
| madurai | public/data/industrial-sources-madurai.json | qualitative one-off academic source (Columbia GSAPP studio book, spring 2016); statistics failed adversarial checks - see the file's _source_caveats |
| madurai | public/data/madurai-localities.json | curated search index, no upstream |
| madurai | public/data/madurai-ward-profiles.json | derived join |
| madurai | public/data/rainfall-recent-madurai.json | daily feed: owned by check-data-freshness.ts |
| madurai | public/data/restoration-priority-madurai-legacy.json | superseded by restoration-priority-madurai.json |
| madurai | public/data/restoration-priority-madurai.json | derived: flagship scorer |
| madurai | public/data/restoration-projects-madurai.json | curated compilation; per-record citations (court orders, MMC, press); no watchable listing |
| madurai | public/data/river-events-madurai.json | curated event timeline; per-record url citations; no watchable listing |
| madurai | public/data/ward-risk-madurai.json | derived 3-factor composite |
| madurai | public/data/water-bodies-flagship-madurai.json | curated flagship register; per-record citations (DHAN, MMC, press); no watchable listing |
| madurai | public/data/water-bodies-lost-madurai.json | archival |
| madurai | public/geojson/madurai-wards-2022.geojson | closed edition: 2022 ward delimitation KML; boundaries change only at the next delimitation (term-expiry watch would be the upgrade) |
| madurai | public/geojson/madurai-water-bodies-lost.geojson | archival, per-feature sources |
| mumbai | public/data/elevation-bands-mumbai.geojson | covered by the platform-scope entry fabdem-dem |
| mumbai | public/data/imd-rainfall-monthly-mumbai.json | scheduled rebuild: imd-rainfall-refresh.yml (P5-1) |
| mumbai | public/data/rainfall-recent-mumbai.json | daily feed: owned by check-data-freshness.ts |
| mumbai | public/data/restoration-priority-mumbai.json | derived: flagship scorer |
| mumbai | public/data/restoration-projects-mumbai.json | curated compilation; per-record citations (NGT/HC orders, corporation schemes, press); no watchable listing |
| mumbai | public/data/water-bodies-flagship-mumbai.json | curated flagship register; per-record citations (corporation reports, Ramsar/sanctuary records, press); no watchable listing |
| mumbai | public/data/water-bodies-lost-mumbai.json | archival: Dwivedi & Mehrotra 1995 |
| mumbai | public/geojson/mumbai-coastal-transects.geojson | our own MNDWI/GEE computation, coastal-shoreline-refresh.yml annual (P5-1) |
| mumbai | public/geojson/mumbai-flood-2005-hotspots.geojson | closed series: 26/7/2005 reference layer |
| mumbai | public/geojson/mumbai-water-bodies-lost.geojson | archival |
| platform | public/data/cascade | covered by the platform-scope entries fabdem-dem / hydrosheds-basins / osm-overpass / google-dynamic-world / sentinel-2-l2a / overture-buildings |
| platform | public/data/cooum-sewage-inlets.json | closed series: Nethaji Mariappan et al. 2017, single study |
| platform | public/data/gee-phase1-water-body-targets.json | our own GEE target manifest, not an upstream |
| platform | public/data/imd-rainfall-monthly.json | scheduled rebuild: imd-rainfall-refresh.yml quarterly; needs freshness coverage (P5-1) |
| platform | public/data/industrial-sources.json | curated compilation (NGT orders, CPCB reports, TNPCB consent records, press); no watchable listing; per-record citation backfill tracked |
| platform | public/data/restoration-priority.json | derived: scored from water-bodies + river layers already covered |
| platform | public/data/rich-bodies | covered by the platform-scope entries jrc-global-surface-water / google-open-buildings / overture-buildings / google-dynamic-world / sentinel-2-l2a |
| platform | public/data/ward-profiles.json | derived join over covered ward-level layers |
| platform | public/geojson/rich-bodies | covered by the platform-scope GEE entries |

## Routes a city deliberately does not ship

Derived by diffing each city against the union of every route any city ships, so this table cannot drift from `FEATURE_AVAILABILITY`. A route dropped without a reason recorded fails `--check`.

| Scope | Subject | Reason |
|---|---|---|
| bangalore | climate-risk | Not built for this city. |
| bangalore | shoreline | Landlocked. |
| chennai | tanker | Not built for this city. |
| delhi | cascades | Not a cascade geography. |
| delhi | climate-risk | Not built for this city. |
| delhi | shoreline | Landlocked. |
| delhi | tanker | Not built for this city. |
| gurugram | allocations | No published entitlement instrument has been located. Gurugram's canal share of Yamuna water is governed by inter-state arrangements that GMDA does not publish, and the ledger's primitive is entitled-vs-received against a named instrument - without the paper there is no row to write. |
| gurugram | cascades | Not a cascade geography. Aravalli johads and village ponds are a real water heritage, but no chained-surplus system was engineered here the way it was in the Tamil kanmoi districts or the Bengaluru kere chains, so the cascade story must not be told about this city. Catchment delineation itself is buildable - GMDA publishes a 10-polygon watershed layer and a natural-flow-direction layer - and is a separate question from the cascade narrative. |
| gurugram | climate-risk | Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. Genuinely buildable and simply not built, so this is backlog rather than refusal. |
| gurugram | commitments | Buildable and not built. The dated commitments exist and are citable (the NGT's February 2026 orders on illegal extraction and rainwater harvesting, GMDA's Chandu Budhera fifth-unit target), but each needs primary-source verification before it goes in the register, and none has had it yet. |
| gurugram | facts | Needs a facts-gurugram.json, which needs the supply and demand numbers that are the very ones still unverified - every figure in circulation for this city is press-sourced, and GMDA's own GIS already contradicts two of them. Ships when the numbers do. |
| gurugram | flood-risk | Gurugram floods by waterlogging on a paved catchment, not by river. The inputs exist on GMDA OneMap (117 GMUC waterlogging sites, the master storm-water network, natural flow direction) and only the drain legs are harvested so far, so this is a backlog item with a known path rather than a refusal. |
| gurugram | groundwater | The signature issue is the thinnest data, which is why this is off rather than empty. Gurugram has been a CGWA dark zone since 2008, but the India-WRIS level record is 37 stations that stop in June 2020 and the Haryana telemetry network does not cover this district at all - 95 MB of the state export contains zero Gurugram rows. 37 stations across 36 wards would not carry honest per-ward interpolation even if they were current. Closes on IN-GRES block assessment plus the HSPCB 2016-2024 quality series, both identified and neither wired up. |
| gurugram | lake-restoration | Needs a restoration-priority-gurugram.json, which needs a scorer. The water-body register is harvested and carries ownership, area and GMDA's own cross-survey flags, so the inputs are present and the ranking is simply not built. |
| gurugram | origins | Not built for this city yet. The spine is identified - GMDA OneMap publishes the MCG limit at 1985, 1996, 2008, 2010, 2015 and 2020, which is the city eating its own catchment in six dated steps - but the narrative is unwritten. |
| gurugram | rivers | Gurugram has no river. Its NWMP monitoring stations are all lakes and borewells, and its surface water leaves the city as drain flow into the Najafgarh jheel and then Delhi's Najafgarh drain. There is nothing to put on a rivers page that would not be an invention. |
| gurugram | shoreline | Landlocked. |
| hyderabad | climate-risk | Not built for this city. |
| hyderabad | my-ward | The 300-ward delimitation gazetted 25 Dec 2025 has no public geometry, and with the corporations under a Special Officer there are no sitting councillors to attach to a ward either. Returns with the ward build, following the Mumbai precedent. |
| hyderabad | shoreline | Landlocked. |
| kolkata | cascades | Not a cascade geography. Tank cascades are a peninsular-India form; the Gangetic delta drains rather than cascading. |
| kolkata | climate-risk | Chennai's sub-basin climate risk comes from HydroBASINS level 12, a global product that would transfer here. It is genuinely buildable and simply not built yet, so this is a backlog item rather than a refusal. |
| kolkata | my-ward | Ward-keyed surfaces are off until KMC wards 142-144 exist as geometry. 141 of 144 are mapped; the missing three are 18.93 km2, 9.2% of the city. KMC publishes no ward geometry through either its own portal or the newer DIGIT one, and OSM has no Kolkata ward relations at any admin_level, so this closes when someone digitises the 2012 delimitation, not by a better endpoint. |
| kolkata | shoreline | Not a coastal city. Kolkata is a tidal river port roughly 130 km upstream of the Bay of Bengal; the riverbank/estuary variant of this surface is a different product and is unbuilt. |
| kolkata | tanker | KMC runs a municipal tanker service and publishes per-trip rates, but no volumes, trips or coverage - so there is nothing to chart that would not be invented. |
| madurai | climate-risk | Not built for this city. |
| madurai | shoreline | Landlocked. |
| madurai | tanker | Not built for this city. |
| mumbai | cascades | Not a cascade geography. |
| mumbai | climate-risk | Not built for this city. |
| mumbai | my-ward | UNRECORDED: Mumbai holds both a 2023 ward-boundary layer and ward-keyed data (a ward risk composite and the Praja per-ward water series), so this is a product decision rather than a data gap - but no rationale for it was ever recorded in the repo, and none is invented here. Resolve by writing down the real reason or by shipping the route. |
| mumbai | tanker | Not built for this city. |

## Absences the product states on the page

Gaps the UI itself renders rather than hiding: the reason below is the copy a reader actually sees. These stay owned by the config they are read from, and are reported here.

| Scope | Subject | Reason |
|---|---|---|
| delhi | storage history chart | Delhi owns no reservoir storage of its own, so no authority publishes a daily storage series for it. BBMB publishes Bhakra's level, inflow and outflow but not Delhi's share as a volume, and Delhi's share of the dam is set per season in BBMB Technical Committee minutes that are not public. Each source card below names who would have to publish the number. |
| delhi | UI language: hi | Advertised as coming soon and rendered as a disabled chip. The hi dictionary is not populated, and must be translated by a native speaker rather than machine-generated, so the UI falls back to English by contract until it is. |
| delhi | water source: DJB tube-wells & Ranney wells | No public tube-well register exists - the CAG's audit records its absence as a finding. |
| delhi | water source: Munak Canal (CLC) | No public daily flow for the 102-km Munak carrier - the single largest input to Delhi's supply. Carriage figures appear only when a shortfall reaches court (June 2024). |
| delhi | water source: Tehri (Delhi share) | THDC publishes Tehri's 300-cusec allocation to Delhi but no daily release against it; the CWC weekly bulletin that carried Tehri storage stopped in May 2025. |
| delhi | water source: Upper Ganga Canal | No public daily release on the Upper Ganga Canal leg; the channel also closes for UP's annual canal maintenance with no Delhi-visible schedule. |
| delhi | water source: Yamuna at Wazirabad | No public daily gauge for the Wazirabad pond. Levels surface only in crisis reporting and Supreme Court filings. |
| gurugram | storage history chart | Gurugram impounds no water of its own. It has no reservoir and no dam, so no storage series exists to chart - here or anywhere else. Its supply is canal water from the Yamuna, groundwater from municipal tubewells, and tankers. |
| gurugram | UI language: hi | Advertised as coming soon and rendered as a disabled chip. The hi dictionary is not populated, and must be translated by a native speaker rather than machine-generated, so the UI falls back to English by contract until it is. |
| hyderabad | UI language: te | Advertised as coming soon and rendered as a disabled chip. The te dictionary is not populated, and must be translated by a native speaker rather than machine-generated, so the UI falls back to English by contract until it is. |
| hyderabad | water source: Nagarjuna Sagar | HMWSSB publishes this level daily, but Nagarjuna Sagar is a parent Krishna storage reported for context, not a city source: it records a city draw of 0 MLD. Its level is the real constraint on Akkampally, which is why it is listed here. |
| hyderabad | water source: Srisailam | HMWSSB publishes this level daily, but Srisailam is a parent Krishna storage reported for context, not a city source: it records a city draw of 0 MLD. Its level is the real constraint on Akkampally, which is why it is listed here. |
| kolkata | storage history chart | Kolkata impounds no water. It abstracts run-of-river from the Hooghly at Palta and pumps groundwater, so there is no storage level to chart even in principle. What would go here is daily abstraction or production volume, and no authority publishes it. Each source card below names who would have to. |
| kolkata | UI language: bn | Advertised as coming soon and rendered as a disabled chip. The bn dictionary is not populated, and must be translated by a native speaker rather than machine-generated, so the UI falls back to English by contract until it is. |
| kolkata | water source: Garden Reach Water Works | No public daily production series. 839.4 MLD is a design capacity; a further 225 MLD is described as under construction with no dated completion. |
| kolkata | water source: Hooghly at Palta (Indira Gandhi WTP) | No public daily abstraction or production figure for Palta, the intake that supplies most of Kolkata. The 1,180 MLD figure is a design capacity from a KMC page labelled draft and footered 2013. |
| kolkata | water source: Jai Hind Jal Prokolpo (Dhapa) | No public daily production series; 136.3 MLD is a design capacity. |
| kolkata | water source: KMC deep tube wells | No public tube-well register or daily draw. The ~110 MLD figure is a single line on KMC's water-distribution page. |
| kolkata | water-bodies catchment atlas | Kolkata has no catchment view, and that is a deliberate omission rather than a missing dataset. Catchments are delineated by tracing water downhill across a 30 m elevation model - which needs a hill. Kolkata has about 11 metres of fall across 40 kilometres of delta, against 43 m in Chennai and 338 m in Mumbai, the cities where this view ships. At that gradient the method would draw confident-looking boundaries that the ground does not support, and in any case most of Kolkata's runoff travels through a combined sewer network rather than over the surface. We would rather show no catchments than invent them. |
| mumbai | UI language: mr | Advertised as coming soon and rendered as a disabled chip. The mr dictionary is not populated, and must be translated by a native speaker rather than machine-generated, so the UI falls back to English by contract until it is. |

