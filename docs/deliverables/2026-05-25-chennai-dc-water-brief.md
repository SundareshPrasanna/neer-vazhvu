---
title: "Chennai Data Centres and Water"
subtitle: "Locations, disclosures, and surrounding water bodies"
date: "25 May 2026"
author: "Neer Vazhvu (https://neervazhvu.org)"
geometry: margin=0.9in
fontsize: 11pt
linestretch: 1.15
linkcolor: "blue"
urlcolor: "blue"
---

## About this document

This brief and the companion spreadsheet (`2026-05-25-chennai-dc-water-data.csv`) compile public-source water-stress and disclosure data for Chennai's named data centres: operator-verified facility locations, CGWB groundwater block status, surrounding documented water bodies within an 8 km radius, operator-side water-disclosure status from the latest published sustainability reports, and an inferred annual water-consumption range per facility derived from operator-disclosed megawatts and published WUE benchmarks.

The brief is meant to be readable on its own. The spreadsheet is the working artifact for filtering, quoting, and cross-referencing.

## How to read the data

Each row in the companion CSV is one named Chennai data centre. Each cell carries a provenance signal:

- **Disclosed.** A number or fact published by the operator on its own page, or by a government body in a notification or report. Cited with the source URL.
- **Inferred.** Not published by anyone. Computed from inputs that are themselves primary-source (for example, operator-disclosed megawatts multiplied by industry-benchmark WUE bands). Both the inputs and the methodology are visible.
- **Not in platform dataset / Pending.** We do not have this cell. The deliverable does not hide gaps; the methodology section names what would be needed.
- **Block-level Safe / Over Exploited.** The Central Ground Water Board's 2024 classification of the revenue block the facility sits in. This is a quantity metric (extraction-to-recharge ratio at block scale) and does not capture water quality, unmetered tanker draft, or sub-block geography. See the caveats section.

For inferred water consumption, the spreadsheet shows three figures (low / central / high) using:

- **Low: WUE 0.15 L/kWh.** Amazon Web Services 2024 global portfolio WUE, the best published in the named operator peer set ([source](https://sustainability.aboutamazon.com/2024-amazon-sustainability-report-aws-summary.pdf)). Represents an aggressive air-cooled benchmark.
- **Central: WUE 0.73 L/kWh.** STT GDC India's published 2020-2024 portfolio average ([source](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-03/STT-GDC-India-ESG-Report-FY2025.pdf)). The only WUE we have located that is specific to Indian data centre operations.
- **High: WUE 1.8 L/kWh.** Lawrence Berkeley National Laboratory 2024 US data centre industry average ([source](https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf)). Represents older Tier-3 evaporative cooling. Chennai's coastal humid climate plausibly pushes the upper bound higher; we have not located an Indian-climate-adjusted benchmark and do not invent one.

Per-megawatt conversion (load factor 0.7, full year): roughly 0.92 ML/yr at WUE 0.15, 4.48 ML/yr at 0.73, 11.04 ML/yr at 1.8.

## Headline findings

**1. Operator-side disclosure of facility-level Chennai water is effectively absent.** Among the named Chennai data centre operators we reviewed, none publishes a facility-level water consumption figure for any Chennai site. The closest published India-aggregate is STT GDC India: 1,149,020 KL withdrawn across all India sites in FY 2024-25, up 8.5% from 1,059,011 KL in FY 2023-24, per the STT GDC India ESG Report FY2025 published March 2026 ([source](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-03/STT-GDC-India-ESG-Report-FY2025.pdf)). Down To Earth's November 2025 audit of operator ESG reports concluded: *"A review of Environmental, Social and Governance (ESG) reports of India's top data center operators - Nxtra by Airtel, AdaniConneX, STT, NTT, CtrlS and Sify - found a consistent and troubling pattern: a pervasive lack of transparency in how these firms report their water use"* ([Down To Earth, 10 Nov 2025](https://www.downtoearth.org.in/science-technology/indias-digital-thirst-what-data-centre-giants-arent-saying-about-their-water-use)).

**2. NTT's 2025 standalone Global Data Centers Sustainability Report omits the India water disclosure that its prior reporting cycle had carried.** The earlier disclosure was 413,779 KL withdrawn / 203,297 KL consumed across 15 India sites in 2023; the 2025 report does not carry an equivalent figure ([NTT GDC 2025 report](https://services.global.ntt/-/media/ntt/global/campaigns/global-data-centers-2025-sustainability-report/global-data-centers-2025-sustainability-report-ntt-data.pdf); Earth Journalism Network analysis).

**3. AdaniConneX has no standalone ESG disclosure.** Parent Adani Enterprises' FY25 Integrated Annual Report carries a single group-level water withdrawal figure - 4,390 ML - covering nine business segments including mining, airports, solar manufacturing, wind, copper, roads, data centres, defense, and digital labs. The figure is up 59% from 2022, the year AdaniConneX commenced operations in Chennai ([AEL FY25 IAR](https://www.adanienterprises.com/-/media/Project/Enterprises/Investors/Investor-Downloads/Annual-Report/AEL-FY25.pdf)).

**4. The data centre clusters sit in two very different CGWB block classifications per the 2024 Dynamic Ground Water Resources Assessment.** Ambattur revenue block, which hosts the largest concentration of Chennai's operational and under-construction data centre megawatts (CtrlS, NTT CHN2, STT 2/3/4, Iron Mountain, Digital Connexion MAA10, CapitaLand, Colt, AirTrunk Chennai parcel), is classified **Over Exploited at 204% of natural recharge** in 2024, with 1,437.7 ha-m availability against 2,933.4 ha-m total annual draft (`public/data/gwr-blocks.json`). Sholinganallur block, which contains the southern OMR-Siruseri cluster (AdaniConneX, Sify Chennai 02, STT-7, Techno Digital, Equinix CN1, Nxtra II), is classified **Safe at 60% of recharge** in 2024.

**5. The Sholinganallur "Safe" classification reflects a quantity metric, not water quality or stress.** Researcher P. Veeraarasu, quoted in Citizen Matters' May 2024 explainer of the Tamil Nadu Water Resources Department GO dated 7 March 2024, noted: *"areas like Sholinganallur in OMR might have a better groundwater level but the water may not be potable"* ([Citizen Matters](https://citizenmatters.in/chennai-water-needs-summer-ground-water-cmwssb-data-gcc/)). The CGWB extraction-to-recharge ratio does not capture water quality, coastal seawater intrusion, or unmetered tanker extraction. The OMR tanker market is currently estimated at approximately Rs 1,000 crore per year by the Federation of OMR Residents Associations (FOMRRA), reported by DT Next in May 2026 ([DT Next](https://www.dtnext.in/news/chennai/omr-residents-welcome-removal-of-cap-on-daily-tanker-trips-but-question-metro-waters-capacity-to-meet-demand-855840)). That draft is outside the official denominator.

**6. CMWSSB has commissioned new desalination capacity but the IT corridor allocation is small.** Of the 150 MLD Nemmeli Phase 2 desalination plant commissioned in February 2024, *"only 15 MLD was allocated for the IT sector, industries, a few streets and apartments between Sholinganallur and SRP Junction, representing merely 10% of the plant's capacity"* ([Citizen Matters](https://citizenmatters.in/water-supply-in-chennais-omr-two-decades-of-broken-promises/), Prabha Koda, January 2026).

**7. The Tamil Nadu Data Centre Policy 2021 has no water provisions located in its text, and expires 31 March 2026.** The policy provides incentives on electricity tax, stamp duty, land subsidy, and capital outlay; it requires 30% renewable energy sourcing for full incentive eligibility. We have not located a water-efficiency target, WUE cap, mandatory ZLD clause, or water-source-disclosure clause in the policy ([ELCOT policy PDF](https://elcot.tn.gov.in/sites/default/file/Data_Centre_Policy_compressed.pdf); summarised in [DCD](https://www.datacenterdynamics.com/en/news/indias-tamil-nadu-government-releases-data-center-policy/)). As of late May 2026, no successor policy draft has been notified on guidance.tn.gov.in, industries.tn.gov.in, or elcot.tn.gov.in.

## Geography - clusters

The two main clusters and their CGWB block status:

| Cluster | Lead operators (operational) | CGWB block (2024) | Class | Dev_pct |
|---|---|---|---|---|
| **Ambattur Industrial Estate** (NW Chennai, GCC Ward 81 Zone VII) | CtrlS DC1+DC2, NTT CHN2-A, STT Chennai 2/3, Digital Connexion MAA10 | Ambattur | Over Exploited | 204% |
| **OMR-Siruseri SIPCOT** (S Chennai, Chengalpattu district, outside CMA wards) | AdaniConneX, Sify Chennai 02, STT-7, Equinix CN1, Techno Digital TD-1, Nxtra II | Sholinganallur | Safe (with caveats) | 60% |

Source for both: `public/data/gwr-blocks.json`, originally India WRIS / CGWB, fetched 27 March 2026.

Other named facilities sit outside these two clusters: NTT CHN1 at Velappanchavadi (Tiruvallur), Sify Chennai 01 at Tidel Park (Taramani, Ward 180), Tata Communications at Mount Road CBD, Yotta announced at Hiranandani Parks Oragadam (Chengalpattu, outside CMA), RackBank announced at Sriperumbudur (Kanchipuram, outside CMA), Princeton Digital CH1 in northern CMA.

## Geography - surrounding water bodies per facility

Each row below lists the named water bodies within 8 km of the operator-disclosed (or DataCenterMap secondary) facility location, sorted by distance (closest first). Source: the Neer Vazhvu platform's Chennai water-body inventory `public/data/gee-phase1-water-body-targets.json` (151 Chennai-area bodies, of which 93 named). Method: haversine distance from facility lat/lng to each named body's centroid. Planning-grade; this is not a watershed analysis. A facility and a water body within 8 km may sit in different watersheds.

In the table below, areas marked with † are verified against canonical sources (Wikipedia citing The Hindu / Times of India / Citizen Matters / news). Areas without † are from the platform's OSM-derived inventory and may differ from canonical CMWSSB / WRD records.

| Facility | Cluster | Surrounding named water bodies (within 8 km, closest first) | Closest (km) | CGWB block class 2024 |
|---|---|---|---|---|
| CtrlS Chennai DC1 | Ambattur | Ambattur Lake† (180 ha reservoir, 1.6 km); Araabath Lake (11 ha, 1.6 km); Ayapakkam Lake (30 ha, 3.1 km) | 1.59 | Over Exploited |
| CtrlS Chennai DC2 | Ambattur | Ambattur Lake† (180 ha, 1.7 km); Araabath Lake (11 ha, 2.1 km); Korattur Lake† (280 ha water spread, 2.9 km) | 1.71 | Over Exploited |
| NTT Chennai 1 (CHN1) | Velappanchavadi | Porur Lake† (81 ha, 1.3 km); JJ Nagar Lake (1 ha, 4.3 km); Ayanambakkam Tank† (85 ha / 210 acres, 4.3 km) | 1.28 | Pending (not in platform block dataset) |
| NTT Chennai 2 (CHN2) A+B | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| STT Chennai 1 (VSB) | CBD-VSB | Kapaleeshwara Koil Kulam (3 ha pond, 3.3 km); ICF Lake (13 ha, 6.6 km); Mariamman Koil Kulam (1 ha pond, 7.2 km) | 3.34 | Pending (CBD area block mapping) |
| STT Chennai 2 | Ambattur | Ambattur Lake† (180 ha, 1.6 km); Araabath Lake (11 ha, 2.1 km); Korattur Lake† (280 ha, 2.9 km) | 1.63 | Over Exploited |
| STT Chennai 3 / 4 | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| STT Chennai 7 | OMR-Siruseri | Padur Lake (58 ha OSM polygon, canonical not verified, 2.7 km); Maambakkam Lake† (~81 ha / 200 acres main part per local sources; 38 ha OSM polygon, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| Sify Chennai 01 (Tidel Park) | Tidel-Taramani | Kallu Kuttai Lake (9 ha, 1.3 km); Anna Nedumchalai Lake (12 ha, 2.1 km); Velachery Lake† (22 ha current, was 107 ha original, 3.9 km) | 1.34 | Over Exploited (Velacheri block, 141.2%) |
| Sify Chennai 02 (Siruseri hyperscale) | OMR-Siruseri | Padur Lake (58 ha, 2.7 km); Maambakkam Lake (38 ha, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| AdaniConneX Chennai 1 | OMR-Siruseri | Padur Lake (58 ha, 2.7 km); Maambakkam Lake (38 ha, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| Yotta Chennai (announced) | Oragadam | Chettipunniyam Lake (96 ha OSM polygon, canonical not verified, 5.1 km); Paranur Lake (15 ha pond, 7.7 km) | 5.11 | Pending (Chengalpattu district profile required) |
| Nxtra Chennai 1 (hyperscale) | Operator does not publish sub-locality | Krishna Nagar Pond (1 ha, 2.1 km); Velachery Lake† (22 ha current, was 107 ha, 5.8 km); JJ Nagar Lake (1 ha, 6.0 km) | 2.09 | Pending |
| Nxtra Chennai II | OMR-Siruseri | Padur Lake (58 ha, 2.7 km); Maambakkam Lake (38 ha, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| Iron Mountain CHN-1 / CHN-2 | Ambattur | Ambattur Lake† (180 ha, 1.2 km); Araabath Lake (11 ha, 1.9 km); Ayapakkam Lake (30 ha, 2.9 km) | 1.18 | Over Exploited |
| Digital Connexion MAA10 | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| Princeton Digital CH1 | Northern CMA | **Korattur Lake† (280 ha water spread, 400 ha total, 0.8 km)**; Athi Villivakkam Eri (7 ha, 3.4 km); Retteri Lake† (~162 ha per revenue records / historically 283 ha, 3.6 km) | 0.78 | Pending |
| CapitaLand CLDC Chennai 01 | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| Colt DCS Chennai | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| AirTrunk Chennai (Ambattur parcel) | Ambattur | Ambattur Lake† (180 ha, 1.5 km); Araabath Lake (11 ha, 3.2 km); Ayapakkam Lake (30 ha, 3.2 km) | 1.46 | Over Exploited |
| Techno Digital TD-1 | OMR-Siruseri | Padur Lake (58 ha, 2.7 km); Maambakkam Lake (38 ha, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| Equinix CN1 | OMR-Siruseri | Padur Lake (58 ha, 2.7 km); Maambakkam Lake (38 ha, 6.5 km); Classic Farms Lake 2 (12 ha, 6.9 km) | 2.70 | Safe |
| Tata Communications Chennai VSB | CBD-Mount Road | Kapaleeshwara Koil Kulam (3 ha, 3.3 km); ICF Lake (13 ha, 6.6 km); Mariamman Koil Kulam (1 ha, 7.2 km) | 3.34 | Pending |
| RackBank Chennai (announced) | Sriperumbudur | SriPerumpudur Lake (278 ha reservoir per OSM polygon, canonical not verified, 1.7 km); Pennalur Lake (24 ha, 2.3 km); Nemmili Lake (30 ha, 3.3 km) | 1.73 | Pending (Sriperumbudur block previously reported Critical 90.28% in 2012-13) |
| Microsoft Azure South India | Chennai (Microsoft does not disclose facility address) | Krishna Nagar Pond (1 ha, 2.1 km); Velachery Lake† (22 ha current, was 107 ha, 5.8 km); JJ Nagar Lake (1 ha, 6.0 km) | 2.09 | Pending |

Key signals from this join:

- **Ambattur Lake (180 ha canonical / 440 acres per The Hindu 2019) sits within 1.2-1.7 km of every named Ambattur-cluster data centre.** That is 13 named facilities (CtrlS DC1+DC2, NTT CHN2-A+B, STT Chennai 2/3/4, Iron Mountain CHN-1+CHN-2, Digital Connexion MAA10, CapitaLand CLDC 01, Colt DCS Chennai, AirTrunk Chennai parcel) clustered around a single rain-fed reservoir, in a revenue block classified Over Exploited at 204% of recharge in 2024.
- **Princeton Digital CH1 (under construction in northern CMA) sits 0.8 km from Korattur Lake.** Per The Hindu 2019, Korattur Lake has a water-spread area of 700 acres (280 ha) and a total area of 990 acres (400 ha). It is a documented urban encroachment hotspot - in 2018, 550 encroachments along the bank were removed by the Chennai Corporation.
- **The OMR-Siruseri cluster (6 named facilities) sits ~2.7 km from a water body labelled "Padur Lake" in our inventory.** The OSM polygon shows 58 ha; canonical area was not located in publicly indexed sources. Treat with caution; verify against TWAD or Tamil Nadu WRD records before citing.
- **RackBank's announced Sriperumbudur site sits 1.7 km from a feature labelled "SriPerumpudur Lake" in our inventory (278 ha OSM polygon).** Canonical area was not located in publicly indexed sources. The Sriperumbudur block was reported Critical at 90.28% of recharge in 2012-13 (Anna University). 2024 status requires the CGWB Kanchipuram district profile pull (named gap).
- **Yotta's announced Oragadam site has no named water body within 5 km.** A feature labelled "Chettipunniyam Lake" (96 ha OSM polygon, canonical not verified) is at 5.1 km. This corner of Chengalpattu has a lower density of named bodies in the platform inventory than the OMR or Ambattur corridors.
- **NTT CHN1 at Velappanchavadi sits 1.3 km from Porur Lake (81 ha canonical / 200 acres per Wikipedia).** Porur Lake is a recognised CMWSSB water source - 46 mcft capacity; a 2012 deepening project proposed expanding capacity to 70 mcft.
- **Velachery Lake (the urban lake near Sify Chennai 01 and within 6 km of Nxtra Chennai 1 + Microsoft Azure South India) has been reduced from its original 265 acres (107 ha) to 55 acres (22 ha) - approximately 80% lost to housing-board encroachment** (Wikipedia citing Times of India November 2025). Our OSM inventory captures the current 20 ha extent, not the original.

**Why OSM areas and canonical areas differ.** Lake-area values in our underlying inventory derive from OpenStreetMap polygons, which mappers trace from satellite imagery at a particular point in time - usually the dry-season visible water surface, not the gazetted bund + seasonal flood extent that CMWSSB / WRD / The Hindu cite. OSM may also split a single canonical lake into multiple polygons (one mapped feature per visible water section). The observed pattern across the lakes we verified: when canonical sources are available, the OSM polygon is consistently SMALLER than canonical (Porur 29 ha OSM vs 81 ha canonical; Korattur 197 ha OSM vs 280 ha canonical; Retteri 95 ha OSM vs 162 ha revenue-record canonical; Ambattur 162 ha OSM vs 180 ha canonical). The one exception we found is Velachery Lake, where the 20 ha OSM polygon closely matches the current encroached 22 ha state (the lake was 107 ha originally; ~80% has been lost to housing-board encroachment).

**The convention in this brief:** areas marked † are verified against a canonical news / Wikipedia / government source (Wikipedia citing The Hindu / Times of India / Citizen Matters). Areas without † are OSM polygons; treat with caution and cross-check before citing specific hectare figures. Lakes for which no canonical source surfaced in publicly indexed search results (Padur, Chettipunniyam, SriPerumpudur, Maambakkam OSM-fragment, Pennalur, Nemmili, Paranur, Classic Farms Lake 2, Krishna Nagar Pond, JJ Nagar Lake, Kapaleeshwara Koil Kulam, ICF Lake, Mariamman Koil Kulam, Kallu Kuttai Lake, Anna Nedumchalai Lake, Araabath Lake, Ayapakkam Lake, Athi Villivakkam Eri) carry the OSM polygon area only.

## Caveats and limitations (transparency layer)

**A. Locations were verified against operator pages, but several operators do not publish street addresses for their Chennai facilities.** Where this is the case, the CSV uses either a DataCenterMap secondary listing (with attribution) or a cluster-centroid coordinate (with confidence marked). NTT, Equinix, AirTrunk, Microsoft, Digital Connexion, and Princeton Digital Group all publish addresses only at sub-locality or cluster level on their own pages.

**B. Operator MW figures conflict in places.** NTT Chennai 1 is published as 2 MW IT load on one operator page and 4 MW on another. Sify Chennai 01 is 1.6 MW on a 2022 factsheet and 3.6 MW on the current page. CtrlS does not publish per-building MW (only "40 MW expandable to 265 MW" at campus level). The CSV notes each conflict.

**C. The CGWB block "Safe" classification for Sholinganallur is a methodological artifact.** It reflects only the official extraction-to-recharge ratio. It does not capture:
- Water quality (coastal seawater intrusion is documented for OMR but not in the classification)
- Unmetered tanker draft, currently estimated by FOMRRA at Rs 1,000 cr/yr for the corridor
- Sub-block geography (the block contains both stressed and less-stressed sub-areas)

The Veeraarasu quote in Citizen Matters May 2024 is the cleanest secondary articulation of this gap.

**D. Inferred water consumption is illustrative, not predictive.** Operators using air-cooled chillers or closed-loop designs (AdaniConneX, Digital Connexion, Microsoft Hyderabad commitment, Yotta marketing claim) will tend toward the low band. Operators using older evaporative cooling designs will tend toward the high band. Without facility-level disclosure, the actual figure is unknown for every Chennai data centre.

**E. The CGWB block dataset on the platform covers Chennai district blocks. Data centres in Tiruvallur (Velappanchavadi), Kanchipuram (Sriperumbudur), and Chengalpattu (MWC, parts of Siruseri SIPCOT, Oragadam) are not in the platform block dataset.** For those, the deliverable points to the CGWB Tamil Nadu 2022 Dynamic Ground Water Resources state volume as the primary source - we have not yet ingested it.

**F. Microsoft Azure, AirTrunk India, RackBank Chennai-specific, Tata Communications Chennai, and Yotta Chennai do not publish Chennai-specific MW.** We do not infer water consumption for these. The deliverable marks "Not computable" with the operator-page citation showing the absence.

**G. Most operator water disclosures audited here trace through two outlets that themselves audited the underlying PDFs page-by-page: Down To Earth's "India's Digital Thirst" series (November 2025) and Earth Journalism Network's "What Data Center Giants Aren't Saying About Their Water Use in India" (2025).** Before any verbatim figure is quoted in print, the operator PDF should be opened directly to attach the exact page reference. The PDF URLs are in the CSV.

## Named gaps that would unblock harder claims

These are the open RTI / portal-query / PDF-read items that would move specific cells from secondary-grade to primary-grade evidence:

1. **Tamil Nadu Water Resources Department.** A clean copy of the 7 March 2024 firka classification GO, including the full enumerated 51-firka list with categories. Currently the only public summary is one outlet (Citizen Matters); the GO itself is not on water.tn.gov.in, tn.gov.in, or groundwatertnpwd.org.in in web-search-indexed form.
2. **TNPCB.** CTE (Consent to Establish) and CTO (Consent to Operate) orders for the named Chennai DC operators in Chennai / Tiruvallur / Kanchipuram / Chengalpattu districts, FY21-FY26. These contain Form-1 declarations of water source, daily KLD, STP capacity, and ZLD claim. OCMMS portal search is interactive; no operator's Chennai DC consent PDF is surfaced via public search-engine indexing.
3. **CMWSSB.** Bulk industrial water connection records and the current per-kilolitre piped industrial tariff schedule. The CMWSSB tariff page exists at https://cmwssb.tn.gov.in/tariff but the full schedule is not in the crawled index. Tanker rates for late 2025 were verified: residential 6,000 L Rs 550, 9,000 L Rs 825; commercial 6,000 L Rs 1,025, 9,000 L Rs 1,535.
4. **CGWA.** NOC list for industrial groundwater extraction in Chennai metropolitan area to check whether any named DC operator appears.
5. **SIPCOT.** Water allocation records for the Siruseri IT Park, Sriperumbudur, and Oragadam industrial plots.
6. **CGWB South-Eastern Coastal Region (Chennai).** Master observation-well roster (NHNS + DWLR + state PWD wells) with coordinates for monitoring wells within 5 km of each cluster centroid.

## Key references and sources

- **Data Centre Policy 2021:** [TN Data Centre Policy 2021 PDF (ELCOT)](https://elcot.tn.gov.in/sites/default/file/Data_Centre_Policy_compressed.pdf); [Data Center Dynamics summary](https://www.datacenterdynamics.com/en/news/indias-tamil-nadu-government-releases-data-center-policy/)
- **Groundwater regulatory framework:** [Chennai Metropolitan Area Groundwater (Regulation) Act 1987 (India Code)](https://www.indiacode.nic.in/bitstream/123456789/13136/1/1987_groud_water_act.pdf); [CMWSSB groundwater regulations page](https://cmwssb.tn.gov.in/rwh-groundwaterregulationsact); [CGWA ground water regulation framework](https://cgwb.gov.in/en/ground-water-regulation)
- **CGWB 2024 block-level data (used for the CSV's CGWB block columns):** ingested in `public/data/gwr-blocks.json` on the Neer Vazhvu platform from India WRIS / CGWB on 27 March 2026
- **Operator-side disclosures:** [STT GDC India ESG FY2025](https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-03/STT-GDC-India-ESG-Report-FY2025.pdf); [Adani Enterprises FY25 Integrated Annual Report](https://www.adanienterprises.com/-/media/Project/Enterprises/Investors/Investor-Downloads/Annual-Report/AEL-FY25.pdf); [Nxtra Sustainability Report 2025](https://assets.airtel.in/nxtra/pdf/Nxtra-Sustainability-Report-2025.pdf); [Sify Infinit Spaces Sustainability Report 2024-25](https://sifyinfinitspaces.com/wp-content/uploads/2025/09/Sify-Infinit-Spaces-Limited_Sustainability-Report-2024-25.pdf); [CtrlS Sustainability Report FY23-24](https://www.ctrls.com/wp-content/uploads/2025/03/sustainability-report-2023-24.pdf); [NTT GDC 2025 Sustainability Report](https://services.global.ntt/-/media/ntt/global/campaigns/global-data-centers-2025-sustainability-report/global-data-centers-2025-sustainability-report-ntt-data.pdf); [Equinix 2024 Sustainability Data Summary](https://www.equinix.com/content/dam/eqxcorp/en_us/documents/resources/data-sheets/ds_sustainability_data_en.pdf); [Iron Mountain DC 2024 Sustainability Overview](https://s204.q4cdn.com/148941814/files/doc_downloads/2024-IMDC-Sustainability-Performance-Overview-FINAL.pdf); [Microsoft 2025 ESR](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/msc/documents/presentations/CSR/2025-Microsoft-Environmental-Sustainability-Report.pdf); [AWS 2024 Sustainability AWS Summary](https://sustainability.aboutamazon.com/2024-amazon-sustainability-report-aws-summary.pdf); [Princeton Digital Group 2024-25 Sustainability Report](https://princetondg.com/wp-content/uploads/2025/07/PDG-SustainabilityReport24-25.pdf); [Tata Communications BRSR FY24-25](https://gamma.tatacommunications.com/assets/wp-content/uploads/2025/06/business-responsibility-and-sustainability-report-2025.pdf)
- **Independent water consumption methodology:** [Lawrence Berkeley National Laboratory 2024 US Data Center Energy Usage Report](https://eta-publications.lbl.gov/sites/default/files/2024-12/lbnl-2024-united-states-data-center-energy-usage-report_1.pdf); [IEA Energy and AI (2025)](https://www.iea.org/reports/energy-and-ai); [Green Grid White Paper #35 - WUE definition](https://airatwork.com/wp-content/uploads/The-Green-Grid-White-Paper-35-WUE-Usage-Guidelines.pdf)
- **Independent journalism (India):** [Down To Earth - India's Digital Thirst (Part 4)](https://www.downtoearth.org.in/science-technology/indias-digital-thirst-what-data-centre-giants-arent-saying-about-their-water-use); [Earth Journalism Network](https://earthjournalism.net/stories/what-data-center-giants-arent-saying-about-their-water-use-in-india); [Mongabay India - India bets on data centres](https://india.mongabay.com/2026/05/india-bets-on-data-centres-even-as-water-energy-use-concerns-mount/); [The Print - Inside Chennai's data centres](https://theprint.in/ground-reports/inside-chennais-data-centres-fortresses-of-the-ai-era/2856488/); [News Minute - Chennai IT corridor tanker extraction Aug 2023](https://www.thenewsminute.com/article/chennai-it-corridor-choked-tanker-lorries-line-tap-groundwater-illegally-181335)
- **Local journalism (Chennai):** [Citizen Matters - OMR water two decades of broken promises (Jan 2026, Prabha Koda)](https://citizenmatters.in/water-supply-in-chennais-omr-two-decades-of-broken-promises/); [Citizen Matters - Chennai water needs summer GW data (May 2024, Shobana Radhakrishnan)](https://citizenmatters.in/chennai-water-needs-summer-ground-water-cmwssb-data-gcc/); [DT Next - OMR residents on tanker trip cap (May 2026)](https://www.dtnext.in/news/chennai/omr-residents-welcome-removal-of-cap-on-daily-tanker-trips-but-question-metro-waters-capacity-to-meet-demand-855840)
- **Comparable global cases (for context):** [Reporters Committee - The Dalles Oregon Google settlement Dec 2022](https://www.rcfp.org/dalles-google-oregonian-settlement/); [Source Material - Aragon Spain data centre water permits](https://source-material.org/amazon-microsoft-google-trump-data-centres-water-use); [DataCenter Dynamics - Singapore Green Mark for DCs 2024](https://www.lexology.com/library/detail.aspx?g=254ea4fc-98b1-465f-9904-2f4c4c3496fc)

## Contact

If a cell needs harder grounding or an additional caveat surfaced, write to the author. Future iterations of this dataset are planned to add the firka-level CGWB layer (Tamil Nadu 2022 state volume), TNPCB OCMMS CTE/CTO PDFs (via RTI), and WRIS station-level readings (via interactive portal capture).
