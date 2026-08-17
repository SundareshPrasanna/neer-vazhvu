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

**Headline: 7 of 15 routes live. 0 empty states, 0 console errors, 0 crashes on the 7 that ship.**

6 XHigh · 4 High · 5 Medium · 7 Low · 2 N/A

The honest one-line summary: **Pune's depth is in its groundwater and its supply governance, and its
thinness is in physical asset geometry.** Where a central regulator or the corporation's own report
is the source, Pune matches or beats Chennai. Where the source has to be a municipal GIS layer,
Chennai is far ahead, because GCC publishes its drain and sewer network and PMC's equivalents are
either absent or too dense to render.

---

## XHigh - Pune exceeds Chennai (6)

| Feature | Chennai | Pune | Multiple |
|---|---|---|---|
| **Groundwater telemetry stations** | 49 | **120** | **2.4x** |
| **Groundwater readings retained** | metadata only | **306,231** (6-hourly, 2022-2026) | platform-first at this density |
| **Rivers with narrative + quality** | 4 | **7** | 1.8x |
| **River monitoring stations** | 13 | **20** | 1.5x |
| **River geometry features** | 4 | **8** | 2x |
| **Reservoir sources tracked** | 4 | **6** | 1.5x |

Two of these need the caveat spelled out, because a bigger number is not automatically better:

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

## High - genuine parity (4)

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

## Medium - present and usable, thinner than Chennai (5)

| Feature | Chennai | Pune | Why thinner |
|---|---|---|---|
| River quality **readings** | 51 | 20 | Pune's per-station series is **one year** (CPCB's 2024 annexure). The 2018, 2022 and 2022-23 values exist and ship, but at *stretch* level rather than per station, so they are carried as river attributes not station readings. Chennai has multi-year per-station min-max from the NWMP tables. |
| Water-body polygons | 1,636 | 484 | Different bounding boxes and a genuinely smaller lake population. Pune's are OSM-only because **PMC publishes no lake layer at all** - its one water-body file is 12 river-channel polygons. |
| Sewage-treatment inventory | 4,188 sewerage features | 20 STP points | Chennai ships CMWSSB's network geometry. Pune ships the plants, with capacity, technology and status, and the 11 proposed sum to exactly the 396 MLD JICA publishes. Different kind of object, not a thinner version of the same one. |
| Ward geometry | 200 wards | 41 prabhags | **Not a deficiency.** Pune has 41 electoral prabhags; that is the actual 2025 delimitation. All 41 are named, which took a join against PMC's own election results because the boundary file carries no names. |
| Wards vintage confidence | one delimitation | four on one dataset page | Pune's ward source ships 76 (2012), 41 (2017), 58 (a 2022 draft that never polled) and 41 (2025). Establishing which was current, and refusing the silent-but-wrong 2017 name join, was most of the work. |

---

## Low - minimal or absent (7)

| Feature | Chennai | Pune | Ours to fix? |
|---|---|---|---|
| **Tanker** | household survey | none shipped | **Yes, and it is the biggest opportunity on the platform right now.** PMC publishes a daily tanker register through an open JSON:API: 409 XLSX files since 25 Apr 2026, per filling point, with prabhag, recipient society, address, vehicle number and scheduled vs on-demand trips. Ramtekadi logged 424 deliveries in one day, in the monsoon. Producer not written. |
| **Localities** | 519 | 0 | Yes. Needs a locality gazetteer; `/pune/my-ward` also needs ward + locality seeding in the DB before it functions. |
| **Facts** | dynamic pipeline | none | Yes, and cheap - the verified numbers already sit in `pune-supply-overview.json` and `river-quality-pune.json`. The compilation is the work. |
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

1. **The tanker producer.** Turns a Low into a probable XHigh - no other city on the platform has a
   per-delivery municipal register at that resolution, and it is sitting behind an open API.
2. **Ward + locality seeding.** Makes `/pune/my-ward` function and closes the localities row.
3. **`facts-pune.json`.** Cheap; the numbers are already verified and in-repo.
4. **The nalla layer** (3,075 features) for a renderable drainage surface.
5. **Commitments**, once each attribution is primary-verified.
6. **CWC weekly backfill** for Khadakwasla and Panshet, which would give the reservoir chart a
   decade instead of starting at onboarding. The dated WRD archive route is documented in
   `data-sources.md` §2 and not yet wired.
