# Gurugram vs Chennai: graded parity scorecard

> Deep audit, 2026-08-17. Every row is **measured from the shipped files**, not estimated - the counts below were read out of `public/data` and `public/geojson` on the audit date, not recalled. Companion to `parity-audit.md` (which explains the *why* behind each gap); this document grades the *how much*.

## Grades

| Grade | Meaning |
|---|---|
| **XHigh** | Gurugram carries materially **more** than Chennai |
| **High** | Genuine parity - comparable in kind and depth |
| **Medium** | Present and usable, but thinner than Chennai |
| **Low** | Minimal or absent. Reason stated; several are not ours to fix |
| **N/A** | Structurally inapplicable. **Not a deficiency** - a difference in the city |

**Headline: 6 of 16 routes live, 0 empty states, 0 console errors, 0 cross-city leaks.**
3 XHigh · 4 High · 4 Medium · 7 Low · 7 N/A

Ten routes are deliberately **off** rather than empty. Every one has a reason in `parity-audit.md`
and a removal condition. The platform rule is that a route in the nav must have something in it, and
a route with nothing in it must not be in the nav - which is why `my-ward`, whose page rendered 296
characters of heading and link, is off rather than shipped thin.

One of the six live routes, `tanker`, is a surface **Chennai does not have**.

---

## XHigh - Gurugram exceeds Chennai (3)

| Feature | Chennai | Gurugram | Multiple |
|---|---|---|---|
| **Tanker transactions** | none | **29,284 bookings** | platform-first |
| **Tanker volume** | none | **1,722,822,000 L** (1.72 bn) | platform-first |
| **Tanker revenue** | none | **Rs 8,72,49,778** | platform-first |

Chennai is the city where the tanker economy is a *story*, and Gurugram is the only city on this
platform where it is a *ledger*. GMDA publishes its own bulk-water booking MIS: 36 months
(2019-01-01 to 2021-12-31), **259 named buyers**, **5,287 delivery sites**, **7 filling stations**,
across **4 water types** at three published tariffs (potable Rs 70.5/kL, recycled Rs 30, CETP-treated
Rs 8).

The finding is the composition, not the volume: **non-potable share went 29.7% to 51.2% in three
years** while tariffs held flat. But the share moved because the **potable side collapsed 64%**
(562 to 202 million litres), not because non-potable grew - non-potable fell too, only 10%
(237 to 212 million). Read as substitution it would be a story about recycling taking hold; read
correctly it is a story about construction stopping. The panel states it the second way, and the
volume series carries the COVID caveat rather than leading with it.

Licence discipline: gmda.gov.in asserts all rights reserved, so the artifact carries **aggregates
only** - counts, sums and shares. No upstream row is republished and the delivery-address column is
dropped at build time.

---

## High - genuine parity (4)

| Feature | Chennai | Gurugram | Note |
|---|---|---|---|
| **Water-body register** | 1,636 OSM polygons | **824 features, 2,851 acres** | Fewer bodies, but a *statutory* register compiled for the NGT with ownership, tehsil, village and remark per body - not an OSM trace. Kind beats count here. |
| **Groundwater assessment history** | 4 years | **4 years** (2021-22 to 2024-25) | All six districts carry the full series. |
| **Lost water bodies** | hand-curated | **29 bodies**, from the publisher's own cross-survey flags | See Medium below for why the count is a floor. |
| **Origins story** | long-form, chaptered | **6 chapters** | Municipal limit 20.1 to 297.3 sq km, 1985-2020, against the 2008 dark-zone notification. |

---

## Medium - present but thinner (4)

| Feature | Chennai | Gurugram | Shortfall |
|---|---|---|---|
| **Groundwater spatial unit** | block | **district, 6 polygons** | The map draws 6 features, not ~30. Correct at the resolution IN-GRES publishes for Haryana; still coarser than Chennai's. |
| **Supply mix** | 6 reservoirs + desal + wells | **2 plants, 572 MLD** | Chandu Budhera 300 + Basai 272, read from GMDA's asset register at build time. Real and current, but a two-row mix. |
| **Lost-body confidence** | named ponds with litigation history | **29 bodies, 1 fully lost** | Only 1 of the 29 is absent from *both* the 2012 satellite pass and Google Earth. The other 28 are "not seen in 2012 imagery", which is a statement about imagery, not destruction. The scorecard grades the strong signal, not the headline. |
| **Origins imagery** | licence-cleared photos + `MANIFEST.json` | **4 images, 2 of 6 chapters bare** | Chapters 3 (groundwater) and 5 (the tanker market) carry no image, because Commons has no Haryana borewell, tubewell or water-tanker photograph. Two further candidates were fetched and rejected - one geotagged 90 km away in Charkhi Dadri, one whose subject rests only on its uploader's title - and both are recorded in `MANIFEST.json` under `_rejected`. |

---

## Low - minimal or absent (7)

| Feature | Why | Ours to fix? |
|---|---|---|
| **Current groundwater depth** | India-WRIS stops at **June 2020**, 37 stations. Haryana telemetry returns **zero rows** for Gurugram across a 95 MB state export. | **No** |
| **Ward profiles** | 36 ward polygons harvested, nothing joined to them. `/api/wards` and `/api/localities` both 404. | Yes, when ward data exists |
| **Ward names** | GMDA's layer publishes `ward_no` and a zone code, **no name** | **No** |
| **Waterlogging / flood surfaces** | 117 GMUC sites + storm-water network verified reachable, only **3 drainage features** harvested so far | **Yes - largest gap** |
| **STP compliance** | HSPCB workbook has **18 Gurugram STPs** + 1 CETP with inlet/outlet BOD/COD/TSS; not wired up | **Yes** |
| **Demand and deficit** | Every figure in circulation is press-sourced; GMDA's development plans are scanned PDFs with no text layer | Not without OCR |
| **Encroachment census** | GMDA publishes ownership and a remark field, no encroachment status | **No** |

---

## N/A - structurally inapplicable (7)

| Feature | Why this is not a deficiency |
|---|---|
| **Days of Water Left** | Gurugram impounds nothing. No numerator exists. |
| **Reservoir cards / storage history** | No reservoirs, no dams. |
| **Catchment rainfall** | No reservoir catchments. |
| **Rivers** | **Gurugram has no river.** Every NWMP station in the district is a lake or a borewell. Surface water leaves as drain flow to the Najafgarh jheel, then Delhi. |
| **Shoreline change** | Landlocked. |
| **Cascades** | Aravalli johads are heritage, but no chained-surplus system was engineered here. |
| **Allocation ledger** | No published entitlement instrument located; the ledger's primitive is entitled-vs-received against a named paper. |

---

## Measured content, route by route

The point of this table is that "live" is a claim about **content**, not about a 200 status code.
Gurugram shipped with a hero rendering Bengaluru's water system and a supply panel citing Madurai's
ADB programme, and every status code was 200 throughout. These are the numbers
`scripts/check-city-surfaces.py` reads back.

| Route | Map features | Rows / records | Verdict |
|---|---|---|---|
| `/gurugram` (dashboard) | - | 2-plant mix, 572 MLD | **live** |
| `/gurugram/groundwater` | **6 polygons** | 6 districts x 4 years = 24 assessments | **live** |
| `/gurugram/water-bodies` | **824 features** | 29 lost bodies | **live** |
| `/gurugram/tanker` | - | 29,284 bookings, 36 months, 259 buyers, 15 top buyers, 7 stations | **live** (Chennai has no such route) |
| `/gurugram/origins` | - | 6 chapters | **live** |
| `/gurugram/about` | - | - | **live** |
| `/gurugram/my-ward` | 36 polygons harvested, **0 joined** | 0 | off - no ward data to attach |
| `/gurugram/rivers` | - | - | off - **N/A, no river** |
| `/gurugram/flood-risk` | 3 drainage legs harvested | 0 | off - largest buildable gap |
| `/gurugram/climate-risk` | - | 0 | off - not built |
| `/gurugram/lake-restoration` | - | 0 | off - scorer not written |
| `/gurugram/shoreline` | - | - | off - **N/A, landlocked** |
| `/gurugram/cascades` | - | - | off - **N/A, no cascade system** |
| `/gurugram/allocations` | - | 0 | off - no entitlement instrument found |
| `/gurugram/commitments` | - | 0 | off - not built |
| `/gurugram/facts` | - | 0 | off - not built |

---

## What this scorecard is for

Before it existed, `/gurugram/rivers` rendered a badge reading **"parity: EASY"** - for a city with
no river. The verdict was a hardcoded prop with the same value on every city's page, and its own
docstring said it was supposed to carry "a source URL or research-memo reference". Nobody had ever
made the assessment.

The badge is now gated on a city having a published audit. This file and `parity-audit.md` are what
that gate points at, and the counts above are what makes them checkable rather than agreeable.
