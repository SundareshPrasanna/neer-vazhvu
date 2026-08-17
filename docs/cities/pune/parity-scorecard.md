# Pune vs Chennai: graded parity scorecard

> Audit 2026-08-17, at the close of the onboarding PR. Every row is **measured from the shipped
> files** with a script, not estimated. Companion to `data-sources.md` (the *why* behind each gap)
> and `features.md` (what each surface shows). Follows the shape `DATA_SOURCES.md` recommends for a
> new city, set by `docs/cities/kolkata/parity-scorecard.md`.

## Grades

| Grade | Meaning |
|---|---|
| **XHigh** | Pune carries materially **more** than Chennai |
| **High** | Genuine parity - comparable in kind and depth |
| **Medium** | Present and usable, but thinner than Chennai |
| **Low** | Minimal or absent. Reason stated; several are not ours to fix |
| **N/A** | Structurally inapplicable. **Not a deficiency** - a difference in the city |

**Headline: 9 of 15 routes live. 0 empty states, 0 console errors, 0 crashes on the 9 that ship.**

8 XHigh · 5 High · 6 Medium · 5 Low · 2 N/A

The honest one-line summary: **Pune's depth is in its groundwater and its supply governance, and its
thinness is in physical asset geometry.** Where a central regulator or the corporation's own report
is the source, Pune matches or beats Chennai. Where the source has to be a municipal GIS layer,
Chennai is far ahead, because GCC publishes its drain and sewer network and PMC's equivalents are
either absent or too dense to render.

---

## XHigh - Pune exceeds Chennai (8)

| Feature | Chennai | Pune | Multiple |
|---|---|---|---|
| **Tanker delivery records** | household survey (sample) | **57,370 individual deliveries** | platform-first: nobody else here has a per-delivery municipal register |
| **Tanker page** | survey panel (sampled prices) | **dispatch panel** on a new 4th `tankerDataKind` | answers a question no other city's data can: was the trip planned? |
| **Groundwater telemetry stations** | 49 | **120** | **2.4x** |
| **Groundwater readings retained** | metadata only | **306,231** (6-hourly, 2022-2026) | platform-first at this density |
| **Rivers with narrative + quality** | 4 | **7** | 1.8x |
| **River monitoring stations** | 13 | **20** | 1.5x |
| **River geometry features** | 4 | **8** | 2x |
| **Reservoir sources tracked** | 4 | **6** | 1.5x |

Three of these need the caveat spelled out, because a bigger number is not automatically better:

- **The tanker register is four months long, not a history.** PMC began publishing these
  spreadsheets on 17 April 2026, so the series starts there and there is no earlier archive on the
  endpoint. It also publishes **counts only** here: 54,235 of the source rows carry a street address
  and 26,326 a phone number, and none of that is republished. That is deliberately stricter than
  Gurugram's ledger, which names its buyers, because Gurugram's buyers are companies and Pune's are
  private housing societies.

- **The 120 groundwater stations are mostly not in the city.** Exactly one stands inside the PMC
  ward boundary (Shivajinagar), tested point-in-polygon. The other 119 instrument the eastern
  irrigation belt. So this is XHigh as *district* coverage and deliberately **not** used to
  manufacture an urban per-ward surface. The count is real; the framing is the finding.
- **The eighth "river" is the Mutha Right Bank Canal**, which is infrastructure, not a river. It is
  drawn because the Khadakwasla Complex is an irrigation project and Pune's entitlement argument is
  unreadable without the other claimant on the same water. Counted honestly here as a river-page
  feature, labelled as not-a-river on the page itself.

**One platform first:** Pune is the first city on this platform whose groundwater assessment is
drilled **below the district**, to taluka. That was not a preference - the district aggregate reads
63.73% and SAFE while Shirur inside it is CRITICAL at 95.71%, so publishing the district figure
alone would have stated the opposite of the finding. The drilled branch in `build_ingres_gwr.py` is
generic and Kolkata and Gurugram can inherit it (see issue #278).

---

## High - genuine parity (5)

| Feature | Chennai | Pune |
|---|---|---|
| IMD gridded rainfall | 672 monthly records, 56 annual totals | **672 / 56** (1970-2025, mean 805.3 mm) |
| Provisional rainfall fill | Open-Meteo daily | Open-Meteo daily, same grid point as the IMD base |
| Groundwater assessment units | 16 blocks | 14 talukas |
| Groundwater assessment editions | 7 | 6 |
| Groundwater block polygons | 16 | 14 |

The rainfall row is exact parity by construction - same producer, same cadence, same span. It is
also the row where Pune needed the most care: the district's 4.7x west-east rainfall gradient means
the grid cell is a real decision, and the cell that *looks* nearest runs 31% above IMD's own Pune
observatory normal. See `data-sources.md` §7.

---

## Medium - present and usable, thinner than Chennai (6)

| Feature | Chennai | Pune | Why thinner |
|---|---|---|---|
| River quality **readings** | 51 | 20 | Pune's per-station series is **one year** (CPCB's 2024 annexure). The 2018, 2022 and 2022-23 values exist and ship, but at *stretch* level rather than per station, so they are carried as river attributes not station readings. Chennai has multi-year per-station min-max from the NWMP tables. |
| Water-body polygons | 1,636 | 791 | **Same source as Chennai.** Chennai's 1,636 is also OpenStreetMap, from `scripts/fetch-water-bodies-osm.ts` - so this is not a source-quality gap, and the residual difference is real: Chennai is eri tank country and Pune is canal command below four dams. Was 484 until the fetch bbox was corrected (see below). PMC itself publishes no lake layer at all; its one water-body file is 12 river-channel polygons. |
| Sewage-treatment inventory | 4,188 sewerage features | 20 STP points | Chennai ships CMWSSB's network geometry. Pune ships the plants, with capacity, technology and status, and the 11 proposed sum to exactly the 396 MLD JICA publishes. Different kind of object, not a thinner version of the same one. |
| Ward geometry | 200 wards | 41 prabhags | **Not a deficiency.** Pune has 41 electoral prabhags; that is the actual 2025 delimitation. All 41 are named, which took a join against PMC's own election results because the boundary file carries no names. |
| Facts page | dynamic pipeline (live + derived, assembled per request) | **22 cards, static snapshot** | Chennai's `/facts` runs live and derived builders at request time and merges them with a static layer. Pune's is a snapshot regenerated by its producer. Thinner in cadence, but not in provenance: **every figure is read out of a shipped artifact rather than transcribed again**, so a quoted card cannot drift from the dashboard it came from - which is the failure mode Kolkata's producer already had to be fixed for. |
| Wards vintage confidence | one delimitation | four on one dataset page | Pune's ward source ships 76 (2012), 41 (2017), 58 (a 2022 draft that never polled) and 41 (2025). Establishing which was current, and refusing the silent-but-wrong 2017 name join, was most of the work. |

---

## Low - minimal or absent (5)

| Feature | Chennai | Pune | Ours to fix? |
|---|---|---|---|
| **Localities** | 519 | 0 | Yes. Needs a locality gazetteer; `/pune/my-ward` also needs ward + locality seeding in the DB before it functions. |
| **Commitments** | register | none | Yes. The dated commitments are citable and sharp (JICA loan signed 13 Jan 2016 for a May 2023 completion, now targeting 2026; the 24x7 project's slide from Dec 2024 to "12-14 months" as of Aug 2026), but each needs primary-source verification of attribution first. |
| **Allocations** | ledger | none | **Partly not ours.** The instrument chain is unusually well documented, but the ledger's primitive is entitled-vs-*received* and **no measured annual draw has been published since 2017-18** - a year for which PMC and the state water department disagree by 4.15 TMC. A ledger whose received column is eight years old and contested is worse than none. |
| **Lake restoration** | priority scoring | none | Partly. No restoration register exists, and no official register of Pune's *lost* water bodies exists either. |
| **Drainage / storm-water geometry** | 10,308 features | 0 rendered | Partly. PMC *does* publish it - 141,341 pipe segments and 3,075 nalla lines - but the pipe register is far too dense for a web map and the nalla layer is the one worth rendering. Not fetched into the repo yet; a deliberate scope call rather than an absence. |

---

## N/A - structurally inapplicable (2)

| Feature | Why |
|---|---|
| **Shoreline** | Landlocked. Chennai's coastal-change surface has no Pune analogue. |
| **Cascades** | Pune district is not a cascade geography in the Madurai/Hyderabad sense - it is a canal command below four dams. The pipeline has also not been run, so this is part refusal, part backlog; graded N/A on the geography. |

**And one that deserves its own row, because it is neither ours nor structural:**

| Feature | Chennai | Pune |
|---|---|---|
| **Flood risk** | 5 hazard geojson layers (2015 + 2020 hotspots, hazard zones, inundation depth, return periods) | **0.** Maharashtra WRD publishes Pune's red (100-year) and blue (25-year) flood lines as **518 scanned PDF map sheets and zero vector files.** `pdftotext` extracts no characters from the Mutha sheets. The event register is solid - 12 Jul 1961 Panshet, the 2019 Ambil Odha flash flood, 25 Jul and 4 Aug 2024, 21 Aug 2025 - but there is nothing to draw. Digitising 518 raster sheets is a project, not a fetch. |

That row is the single largest capability gap against Chennai, and it is a publishing decision by a
state department rather than a data-engineering task. Retire it when a vector flood line exists, or
when the Bombay High Court's June 2025 order to redraw Pune's flood lines produces one.

---

## Where Pune is *deeper* than Chennai in kind, not count

Three things Pune ships that have no Chennai equivalent and are not captured by any row above:

1. **A cross-checked reservoir capacity set.** Every dam capacity is verified against a second,
   independent government register - CWC's NRLD-2019 agrees to the cubic metre on four of six - and
   the Khadakwasla chain total independently reproduces PMC's own published figure to 0.03%. Two
   register errors were found and recorded in the process (NRLD-2019's Khadakwasla row is 10x high;
   NRLD-2023's Chaskaman and Bhama Askhed rows are 1000x low).
2. **A build that fails on its own transcription.** `build_pune_supply.py` refuses to write if the
   transcribed water-budget rows stop summing to PMC's own stated totals. It also surfaces that
   PMC's published budget does not close by 0.53 MLD, and ships both of PMC's figures rather than
   correcting one.
3. **A documented reporting failure, not just a data gap.** PMC reprinted an identical
   service-level-benchmark table for four consecutive years. The artifact says so, and the surfaces
   present that column as one observation rather than a four-year trend.

---

## What would move the grades

In rough order of value per unit of work:

1. **Ward + locality seeding.** Makes `/pune/my-ward` function and closes the localities row.
2. **The nalla layer** (3,075 features) for a renderable drainage surface.
3. **Commitments**, once each attribution is primary-verified.
4. **CWC weekly backfill** for Khadakwasla and Panshet, which would give the reservoir chart a
   decade instead of starting at onboarding. The dated WRD archive route is documented in
   `data-sources.md` §2 and not yet wired.

**Done since this scorecard was first written:** the tanker producer *and* its panel (item 1 in the
original list, now two XHigh rows), `facts-pune.json` (item 3, now the Medium row above), and the
water-bodies bbox correction below.

---

## The correction this audit produced

Writing the water-bodies row is what caught the defect. The row read "484 polygons, different
bounding boxes" and treated the gap against Chennai as a fact about the two cities. Two checks broke
that reading:

1. **Chennai's layer is the same source.** 1,636 polygons from OpenStreetMap via
   `scripts/fetch-water-bodies-osm.ts`, ODbL. There was no source-quality difference to explain.
2. **The Pune fetch bbox was smaller than the Pune map.** `build_pune_geography.py` queried Overpass
   at `18.38,73.65-18.72,74.05` while `pune.bbox` in the city config is
   `18.3,73.4-18.95,74.05` - roughly a third of the frame the reader can pan over.

Everything west of 73.65 was outside the query, which meant **Panshet, Warasgaon, Temghar, Pawana,
Mulshi and Bhama Askhed were all absent from the layer** - every reservoir Pune drinks from except
Khadakwasla, missing from the city's own water-body map while the dashboard's reservoir cards named
them by name. Correcting the bbox took the layer from 484 to **791 polygons** and 64 to 84 named,
and pulled in Andhra, Bushi, Gunjavani, Valvan, Shirota, Tungarli, Uksan, Kasarsai and Tata besides.

Two things now guard it. The producer **fails loudly if any of the six source reservoirs is absent**,
because a bbox is exactly the kind of parameter that narrows by accident and still produces a
plausible-looking map. And that guard carries both spellings of two of them: OSM writes *Varasgaon*
and *Pavana* where the WRD bulletin writes Warasgaon and Pawana, and the first version of the check
reported a false gap on precisely that. Same trap as MAVAL/Mawal in IN-GRES.

Seven features were also removed, and counted on the artifact rather than silently dropped: three
swimming pools, a gym pool, a service reservoir, a rainwater-harvesting sump, and one pool carrying
no water tag at all. The name match is narrow deliberately - *talav* is a real water body here, and
a broader match for "tank" would have deleted Ganesh Talav and Lakaki Talav.

### And what going beyond OSM would actually buy

Asked directly whether OSM is enough, the answer is that it is not a register, and for Maharashtra no
open register exists:

| Route | Result |
|---|---|
| **MRSAC / MahaGIS** - the state remote-sensing centre, Maharashtra's analogue of the open TNGIS GeoServer that gives Chennai 70k tanks | Does not resolve publicly. `mahagis.mrsac.gov.in` has no DNS record; `mrsac.maharashtra.gov.in` times out. |
| **Bhuvan / NRSC vector** | Answers a WFS request `ServiceUnavailable: Service WFS is disabled`, on both `bhuvan-vec1` and `bhuvan-vec2`. Raster tiles only. Same class of dead end as PCMC's WMTS. |
| **First Census of Water Bodies (2018-19, Ministry of Jal Shakti)** | **Exists for Maharashtra and is not a substitute.** See below. |

The census is the one real find, and it fails on enumeration quality rather than on access. 3,680
records for Pune district, each a point with area, depth, ownership and use. But:

- **Only 10 of the 3,680 are inside PMC**, and 45 in the whole district are urban. It is a *minor
  irrigation* census: it counts rural tanks, and it is effectively blind inside the city.
- **The condition columns are unfilled defaults.** 3,679 of 3,680 "not encroached"; 3,676 of 3,680
  with use "Ground water recharge"; 3,680 of 3,680 in use, none defunct; 3,679 of 3,680 man-made;
  ownership 3,618 "State WRD" and 62 "Co-operative", with no panchayat, municipal or private row
  anywhere. Chennai's cut of the same census carries populated encroachment percentages and
  original-versus-present storage, so this is a per-state enumeration difference, not a schema one.

So it belongs here as a **district irrigation-tank layer with a documented enumeration-quality
finding**, not as city water-body coverage, and publishing "3,680 water bodies in Pune" as a
coverage improvement would be laundering an empty form. One licence note if it is ever loaded: the
copy with point geometry is OpenCity's, labelled Creative Commons **Non-Commercial**, which is the
encumbered bucket. The better-licensed route is data.gov.in, which is where Chennai's cut comes from
and which carries the fuller schema, and that needs an API key the repo does not have.
