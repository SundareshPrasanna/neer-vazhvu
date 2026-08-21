# Data Sources - Gurugram

> Where each Gurugram dataset comes from, how often it refreshes, and what to watch out for.

Gurugram is the ninth onboarded place and the first modelled as a city that **owns no water**. Every
previous city has a source it controls: a reservoir, a river abstraction, a lake system, a canal
entitlement. Gurugram has a canal it does not own, an aquifer it over-draws, and a tanker market.

Its data landscape has an unusual shape. It is **strong where the authority happens to run a GIS**
(824 water bodies with ownership and cross-survey attribution, 36 ward polygons, the plant register)
and **strong where the authority happens to run a billing system** (29,284 tanker bookings at
transaction resolution, which no other city on this platform has). It is **weak on everything in
between** - no published demand figure, no water level since June 2020, no ward-level anything.

That is a pattern worth naming, because it is not about how much water data exists in Gurugram. It
is about which of GMDA's internal systems happen to have a public endpoint.

Absence claims follow the Madurai hedging rule: "no known public X".

## The three sources

Everything Gurugram ships traces to exactly three upstreams, registered in
`scripts/source-registry/gurugram.json` with detection method, licence and artifact lineage.

| Source | Type | Licence posture | Cadence |
|---|---|---|---|
| `gmda-onemap-arcgis` | ArcGIS REST | **restrictive, permission required** | irregular, no revision feed |
| `gmda-tanker-mis` | per-year XLSX | **restrictive, permission required** | annual, **stopped after 2021** |
| `ingres-groundwater-haryana` | IN-GRES API | GoI assessment portal, cited with attribution | yearly |

Two of the three are **unlicensed in the reuse sense**, and that shapes what ships. See "Licence
discipline" below.

---

## 1. GMDA OneMap (`gmda-onemap-arcgis`)

| | |
|---|---|
| **Host** | `onemapdepts.gmda.gov.in/server/rest/services` |
| **What it is** | ArcGIS Server 11.2 with a fully open, unauthenticated REST directory, 32 folders |
| **Acquisition** | `neer-vazhvu-api/scripts/harvest_arcgis_rest.py --city gurugram` |
| **Detection** | `api-date` on `currentVersion` |
| **Verified** | 2026-08-14 - service listing, layer metadata, `where=1=1` with `outFields=*`, `returnCountOnly` and `f=geojson` all work with no token |

The contrast worth recording is with Surat's IGiS portal, where WFS is disabled and only rendered
tiles plus attributes are available. Here the **vectors** come out.

### What it produces

| Artifact | Content | Note |
|---|---|---|
| `gurugram-water-bodies-current.geojson` | **824 features, 2,851.3 acres** | The NGT register. Per body: village, tehsil, area, ownership, remark, and five cross-survey flags |
| `gurugram-wards-2026.geojson` | **36 features** | Ward number and zone code. **No ward name is published** |
| `gurugram-drainage.geojson` | **3 features** | Only the trunk legs so far; the full storm-water network is reachable and not yet harvested |
| `gurugram-supply-overview.json` | 2 plants, **572 MLD** | Chandu Budhera 300 + Basai 272, read from the WTP layer at build time |
| `water-bodies-lost-gurugram.json` | **29 bodies** | Derived from the register's own flags - see §4 |
| `gurugram-gwr-blocks.geojson` | **6 features** | District boundaries (layer 20) joined to IN-GRES values - see §3 |

### Three harvester guards, and why each exists

The first version of this harvester **wrote a zero-feature drainage file and reported success**. All
three guards below trace to that.

1. **In-band errors.** ArcGIS returns errors as HTTP 200 with an `error` key in the JSON body. The
   harvester raises on `doc.get("error")` rather than treating the response as an empty result set.
2. **Paging.** `resultOffset` is only added once a first page has genuinely come back. Sending it on
   the initial request silently returned nothing for some layers.
3. **Pinned counts.** Every layer carries an `expect` count. A harvest that returns zero features,
   or a different count than the one recorded, fails loudly instead of overwriting a good file with
   an empty one.

---

## 2. GMDA tanker MIS (`gmda-tanker-mis`)

| | |
|---|---|
| **Host** | `gmda.gov.in/static/report/Water%20Tanker%20MIS%20Report%20{YYYY}.xlsx` |
| **What it is** | GMDA's own bulk-water booking ledger, one XLSX per year |
| **Discovery** | **No index page links to these files.** The landing page is `gmda.gov.in/onlineservices/water-tanker.html`; the reports sit at a static path |
| **Acquisition** | `neer-vazhvu-api/scripts/build_gurugram_tankers.py` |
| **Detection** | `url-template` from 2019, with `expectContentType: application/xlsx` |
| **Verified** | 2026-08-14 |

Per booking the sheet carries: timestamp, dispensing station, water type, named buyer, delivery
address, tanker size and amount.

### Counts, raw and accepted

| Year | Rows in file | Rejected | Accepted |
|---|---|---|---|
| 2019 | 12,337 | 1 | 12,336 |
| 2020 | 9,741 | 1 | 9,740 |
| 2021 | 7,208 | 0 | 7,208 |
| **Total** | **29,286** | **2** | **29,284** |

Two rows are structurally corrupt and are dropped. `rows_rejected` is reported per year in the
artifact rather than being silently absorbed, because a rejection count that quietly grows is how a
parser failure hides.

### The soft-404 trap

**GMDA returns HTTP 200 with an HTML page for years that do not exist.** A naive
`url-template` watcher would therefore report a new edition every year forever. Two defences:

- The fetcher checks the ZIP magic bytes (`PK\x03\x04` / `PK\x05\x06`) before parsing, so an HTML
  body is rejected rather than fed to the XLSX reader.
- The registry entry carries `expectContentType: "application/xlsx"`, and the template is baselined
  at **2019-2021 only** rather than running to the current year.

A 2022 file appearing is the event we want. The watcher is configured so that it would be a real
signal rather than noise.

---

## 3. IN-GRES groundwater (`ingres-groundwater-haryana`)

| | |
|---|---|
| **Host** | `ingres.iith.ac.in`, endpoint `getBusinessDataForUserOpen` |
| **Publisher** | CGWB + Haryana state groundwater department, portal run by IIT Hyderabad |
| **Acquisition** | `neer-vazhvu-api/scripts/build_ingres_gwr.py --city gurugram` |
| **Detection** | `human-review` every 120 days |
| **Licence** | Government of India assessment portal, cited with attribution |

### Content

**Six districts x four assessment years** (2021-22, 2022-23, 2023-24, 2024-25), latest values:

| District | Stage of extraction | Category |
|---|---|---|
| **Gurugram** | **194.6%** | over-exploited |
| Faridabad | 175.4% | over-exploited |
| Rewari | 133.2% | over-exploited |
| Palwal | 92.0% | critical |
| Nuh (Mewat) | 72.3% | semi-critical |
| Jhajjar | 49.6% | safe |

Neighbours are carried deliberately: an over-drawn district ringed by other over-drawn districts has
nowhere to borrow from, and clipping the map to Gurugram alone would hide that.

### The state-UUID trap

IN-GRES exposes a state bundle table that **looks** like the right thing to scrape and is not - it
is a decoy that does not carry the assessment values. The correct call asks the API at COUNTRY level
with `parentuuid` set to the state UUID (Haryana:
`648a95f6-9249-4c92-8ae4-a9d93eb7c898`), `view: "admin"`, lowercase keys and a no-spaces `locname`.
That is recorded in a long comment in the builder rather than only here, because the next person to
touch it will be reading the code.

### The join

`build_gurugram_gwr_geojson.py` joins GMDA's district boundary layer (layer 20, all 22 Haryana
districts) to the IN-GRES values. Both sides spell `GURGAON` and `MEWAT` identically, so the join is
exact rather than fuzzy. **The script refuses to write if any district lacks a boundary** - a partial
choropleth is worse than none.

---

## 4. Lost water bodies: derived from the publisher's own attribution

Kolkata's, Delhi's and Bengaluru's lost-bodies files are hand-curated from litigation records, news
archives and academic surveys. Gurugram's is not, because GMDA already did the join.

Every body in the register carries a flag for whether it appears in:

| Flag | Survey | Bodies flagged |
|---|---|---|
| `in_ror_1956` | 1956 record of rights (revenue map) | 283 |
| `in_soi_1976` | 1976 Survey of India sheets | 223 |
| `in_worldview_2012` | 2012 WorldView imagery | 645 |
| `in_google_earth` | Google Earth | 691 |
| `in_drone` | drone survey | - |

**Of the 283 bodies matched to a 1956 revenue plot, 29 were not seen in the 2012 satellite pass.**
One of those 29 is absent from Google Earth as well.

### Three things this must not claim

1. **It is a floor, not a total.** The register is the 2012-known population. A pond that existed in
   1956 and had already gone by 2012 is not a row in it at all.
2. **The vintage counts are not a series.** OneMap carries separate per-vintage water-body layers
   alongside the register, and their counts **rise** at the end - roughly 640 (1956), 519 (1976),
   824 (2012) - because three survey methods have three inclusion criteria, and satellite picks up
   construction pits and seasonal water a revenue clerk never listed. Charting those three as a
   trend would read as recovery. Nothing on the site plots them, and this row is why.
3. **Absence from imagery is not proof of destruction.** A seasonal johad photographed dry, or one
   under tree cover, reads identically. Every entry says `"Not seen in 2012 imagery"`, never
   `"Lost"`.

### Ownership, which is the actual finding

| Owner | Bodies |
|---|---|
| Gram Panchayat | 392 |
| Private | 208 |
| **Municipal Corporation (MCG)** | **62** |
| Gram Panchayat / Civil Panchayat Deh | 28 |
| Government | 20 |
| Gram Panchayat & Private | 20 |
| Abadi Deh / Shamlat | 18 |
| Others | 14 |

And **163** of the 824 sit inside the Municipal Corporation's boundary at all, against **454** inside
the wider GMDA area. The body most residents would petition about a filled pond is responsible for a
fraction of the register.

---

## Licence discipline

Both GMDA sources are **restrictive**: gmda.gov.in asserts "All rights reserved" and publishes no
reuse or redistribution policy. The ArcGIS REST directory serves no licence or access-constraint
statement at all - it is open in the **access** sense and unlicensed in the **reuse** sense.

What follows from that:

- The tanker artifact carries **aggregates only** - counts, sums, shares. No upstream row is
  republished.
- The **delivery-address column is dropped at build time** and never lands in the repo.
- The full 259-name buyer list is not republished; the artifact carries the top 15, because the
  finding is the concentration and the sector, not the names.
- Every artifact envelope names the source with `license` populated from
  `scripts/registry_license.py` rather than a hand-typed string, so the posture cannot drift
  between artifacts.

The lost-bodies envelope records the source `role` as **`input`** rather than `finding`: GMDA stands
behind the register and its cross-survey flags, but the "in 1956, absent in 2012" **selection** over
them is ours.

---

## Known gaps, with the blocker named

| What is missing | Blocker | Ours to fix? |
|---|---|---|
| **Demand / deficit** | Every figure in circulation (675-700 MLD peak) is press-sourced. GMDA's Final Development Plan and Social Infrastructure Development Plan are **scanned PDFs with no text layer** | Not without OCR we would have to stand behind |
| **Current groundwater level** | India-WRIS stops at **June 2020**, 37 stations. Haryana telemetry returns **zero rows** for Gurugram across a 95 MB state export | **No** |
| **Ward names** | GMDA's ward layer publishes `ward_no` and a zone code and no name | **No** |
| **Ward profiles** | 36 polygons harvested, nothing joined. `/api/wards` and `/api/localities` both 404 | Yes, when ward data exists |
| **Waterlogging / storm-water** | 117 GMUC sites, master network, flow direction and 10 watersheds all verified reachable on OneMap; only 3 drainage features harvested | **Yes - largest gap** |
| **STP compliance** | HSPCB workbook carries 18 Gurugram STPs + 1 CETP with inlet/outlet BOD, COD, TSS against consent limits | **Yes** |
| **Encroachment status** | GMDA publishes ownership and a remark field, no encroachment flag | **No** |
| **Long-run rainfall** | No IMD gridded base series generated for grid point (28.4360, 77.0560) yet | Yes - exemption `gurugram:rainfall-recent` records the removal condition |

---

## Freshness watch

`gurugram:rainfall-recent` is the only freshness exemption. Its removal condition is recorded in
`scripts/lib/exemptions.ts` rather than as prose here: generate
`imd-rainfall-monthly-gurugram.json` and wire the city into `fetch_recent_rainfall.py`.

The ten routes that are off carry their reasons in `ROUTE_OFF_REASONS` in the same file. Two of them
(`rivers`, `shoreline`) are permanent - Gurugram has no river and is landlocked - and the rest name
what would close them.
