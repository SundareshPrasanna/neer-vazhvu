# Delhi - features and methodology

> Detailed feature inventory for Delhi, including how it differs from Chennai, Madurai, Bengaluru and Mumbai. The high-level overview lives in [README.md](../../../README.md); the data-source breakdown, with provenance for every file, in [data-sources.md](data-sources.md).

Delhi is the fifth onboarded city and a **standalone NCT place**, deliberately not an NCR region. The Mumbai MMR precedent does not transfer: Gurugram, Noida and Ghaziabad sit in three different states with three pollution control boards, separate utilities, and no shared supply or regional data spine - none of the conditions that justified modelling Mumbai as nine corporations. The genuinely trans-boundary Yamuna story is carried by *page scope* instead (rivers and flood-risk are labelled Yamuna-basin; dashboard, groundwater and my-ward are NCT), with a future Yamuna basin surface as the proper home for it.

The supply model is Bengaluru-like (`heroMode: 'cauvery-pumping'`) but with a twist: nothing is pumped uphill. Delhi owns no storage at all, and ~90% of its raw water arrives **by gravity canal from five other states** under a stack of legal instruments. So the hero tells a supply-chain story anchored on distance and paper, not lift.

### The defining constraint: no daily supply feed exists

Every other city on the platform has at least one authority publishing daily storage. Delhi has none, and this shapes several surfaces:

- All six `waterSources` carry `hasPublicFeed: false` **plus a `noFeedNote`** (a field Delhi introduced) naming who would have to publish the number. Without it the cards said "DJB does not publish daily levels" for Bhakra and Tehri, misattributing the gap - those belong to BBMB and THDC.
- Verified 25 July 2026: BBMB's public reservoir page last updated **04.09.2025**; CWC's weekly Reservoir Storage Bulletin listing ends **08.05.2025**. Both upstream feeds that could carry Bhakra/Tehri are dormant, so there is no scraper to write.
- The storage-history empty state was changed platform-wide: for a city where no source has a public feed it no longer promises the chart "fills in automatically", because nothing can arrive.
- The dashboard "PREVIEW - waiting for first daily ingestion" pill now also respects `hasPublicFeed`; it would otherwise have sat on Delhi's dashboard permanently.

Delhi's live layer is therefore **rainfall** (IMD 0.25° gridded history since 1970, long-term mean 624.8 mm, extended by Open-Meteo reanalysis through yesterday, refreshed by the daily cron) and its high-cadence layer is **monthly** DPCC water quality.

### Dashboard

- **Cauvery-pumping hero** with per-city `hero_copy` overrides in `delhi-supply-overview.json` - the shared component's default narrative is Bengaluru's (Kempe Gowda, T.K. Halli, "uphill from Cauvery"), which is wrong for a gravity-canal city, so Delhi overrides the strings rather than forking the component.
- **Supply-overview tile** anchored on the CAG performance audit of DJB (Report No. 3 of 2025, tabled 23 Mar 2026): NRW 51-53%, Rs 4,988 crore revenue impact, Rs 66,595 crore debt, only 40% of production billed. DJB's own source-wise raw-water split comes from Delhi Economic Survey 2023-24 Ch. 13 - the chapter that calls 52.35% of the city's water "wasted or pilfered by tanker mafia". Where the Survey's claimed availability and the CAG's audited production disagree, both are shown.
- **Demand horizon is MPD-2041, not 2034** - the shared component's demand line hard-codes Chennai/Madurai's ADB design horizon, so Delhi supplies a `demand_headline` override. The plan's 1,455 MGD (~6,614 MLD) target for 2041 already assumes the per-head norm is **cut from 60 to 50 GPCD**.

### Groundwater

- **District-level CGWB choropleth** - Delhi's assessment unit is the district (11 mapped + the non-spatial "Nazul Land" estate unit), not the block. 2024-25: four districts Over-Exploited (New Delhi 123.2%, Shahdara 112.2%, North East 106.0%, South 103.4%); NCT overall 92.1%.
- **Four assessment cycles** (2021-22 → 2024-25) with `year_label` carrying the source's own hydrological labels - added because the portal labels editions by span ("2023-2024") while mirrors label them by end year ("2024"), a mismatch that cost real confusion.
- **`history_caveat` per block** (new field): the shared default explains Bengaluru's compound-block splits, which is not why Delhi's series is short. Delhi states the real reason - annual assessment began only in 2021-22, and pre-2022 editions used ~34 *tehsils* rather than 12 districts, so they cannot be stitched on.
- The 2022-23 cycle has no mirrored dataset anywhere and was taken from **IN-GRES** directly (`public/data/ingres/delhi-2022-2023.json`). IN-GRES is IIT-Hyderabad hosted and therefore outside the NICNET blockade - see [the pan-India source playbook](../../methodology/pan-india-source-playbook.md).
- Per-ward depth and ward risk are deliberately **off**: the live WRIS network is India-IP gated, and per-ward precision will not be manufactured from unverified station density.

### Rivers (Yamuna-basin scope)

- Five channels: Yamuna, the Western Yamuna Canal / Munak carrier, Hindon, and the Najafgarh and Sahibi courses - **the same water**, since OSM maps most of the Najafgarh drain as the Sahibi's engineered reach. The two entries cross-reference each other rather than pretending to be separate rivers.
- **DPCC monthly water quality** - 8 Yamuna stations + ~39 drain points, the highest-cadence public river feed of any city here (every other city is on annual CPCB NWMP). The station panel is *derived* from the monthly file by `scripts/build-delhi-river-quality.ts` so panel and series cannot drift.
- Gaps: Barapullah and Shahdara drains are unmapped in OSM under those names; the DPCC reports are scanned PDFs, so extension is an OCR task; the 13-plant CETP monthly archive (2019-2024, 62 bundles) is indexed with a transcribed sample but not bulk-extracted.

### Flood risk (narrative variant)

Delhi has **no public flood model** - no CFLOWS/iFLOWS equivalent - so the modelled hazard zones and return-period extents that Chennai ships have no Delhi counterpart, and nothing weaker is substituted in their place. What exists is a release-driven threshold structure: Hathnikund → Old Railway Bridge on a 36-72 hour lag, with 204.50 m warning / 205.33 m danger / 206.00 m evacuation, and a first warning at ~1 lakh cusecs.

- Seven events, 1978-2025, each sourced individually. Levels are cited where the record carries levels (2023's record 208.66 m; 1978's 207.49 m benchmark); the CWC case study's historical table carries **discharges, not levels**, so 1988/1995/2010 are stated as peak discharges - 1995 was the largest flow between 1978 and 2023.
- **Chronic-waterlogging register** in place of hotspot polygons: the named perennial sites (Minto Bridge, Pul Prahladpur, Zakhira, Dhaula Kuan, Moolchand, ...) with the official count hierarchy alongside (448 traffic-police-mapped points, 169 identified locations, 71 nodal-officer sites) - counts that reporting cites but no agency publishes as data.
- This shape required a new `WardFloodSection` variant (`chronic_hotspots`), since the shared ward card assumed modelled hazard categories and crashed on anything else.

### Water bodies

- 1,845 OSM polygons (~5,805 ha). The largest is the **601-hectare Najafgarh Jheel remnant** - independent corroboration of the ~226 sq km → ~7 sq km collapse after colonial-era drainage turned the Sahibi into the Najafgarh drain.
- **Jal Dharohar census** (2022 enumeration): all 893 Delhi records joined to the polygons - 31 inside, 203 within 150 m, and **659 recorded as unmatched** rather than force-fitted, because the census enumerates johads and recharge pits OSM has never mapped.
- 12-body flagship register spanning the hauz/baoli chain (Hauz-i-Shamsi 1230, Hauz Khas, Agrasen/Rajon/Nizamuddin baolis, Tughlaqabad cisterns) and the modern lakes; 7-entry lost-water register. Restoration priority scores the flagship register only - a documented limitation against Chennai's 1,787-polygon scoring.

### My Ward

- **250 MCD wards** of the post-2022 unified delimitation (not the pre-merger 272 or the commonly-cited 270). The geometry is the only public digitization of that delimitation; its OpenCity dataset was delisted, and the copy in this repo was byte-verified against the Internet Archive's capture before use.
- Joins water bodies + census records, lost bodies, chronic flood hotspots, mapped drain length, nearest DPCC station, delimitation population, and **councillor with party and seat reservation** from the Dec 2022 election (party split validates: AAP 134 / BJP 104 / INC 9 / IND 3).
- MLA/MP are **not** shown - the ward→assembly-constituency mapping exists in the geometry but the result sets are not ingested, and this made MLA/MP optional end-to-end in the shared hook, component, header and CSV export.
- Sewerage marked unavailable (DJB's network dataset was delisted, no copy survives). DUSIB's 675 JJ-basti roster (306,521 households) is in the repo but not ward-attributed: the public PDFs carry no coordinates and use pre-2022 ward numbers.

### Accountability surfaces

- **Allocation Ledger** - arguably the platform's strongest instance: five instrument-governed arrangements (1994 five-state MoU 0.724 BCM/yr; Munak carrier fixed ~1,050 cusecs by the 2018 Standing Committee; Bhakra's share set meeting-by-meeting in BBMB minutes; Tehri 300 cusecs; unregulated groundwater). The received side is largely null **on purpose** - that is what the public record contains, and the entitled-vs-opaque asymmetry is the finding.
- **Commitments Register** - eight dated promises with original citations, never overwriting a date. The lead entry is already `overdue`: the target to trap all 39 major drains by 30 June 2026 passed without a public completion statement. DPCC's monthly drain readings are the verification instrument - a trapped drain reads "no flow".

### Origins

Four-chapter long-read with four Wikimedia Commons images (PD/CC, per-file provenance in `public/images/story/delhi/MANIFEST.json`): the thousand-year stored-water city (Anangpur → Hauz-i-Shamsi → Nahar-i-Behisht), the colonial unmaking, the five-state straw, and the instrumented decline. English at launch; Hindi follows the i18n pass.

### Deliberately not shipped for Delhi V1

`/shoreline` (landlocked), `/climate-risk` sub-basins (no published Delhi basin risk decomposition), `/cascades` (baoli/hauz is not a tank-cascade geography), `/tanker` (DJB's booking portal is ToS-gated; the Sangam Vihar tanker economy is carried in facts and the equity narrative instead).
