# Gurugram - features and methodology

> Feature inventory for Gurugram, including how it differs from the eight cities before it. The data-source breakdown, with provenance for every file, is in [data-sources.md](data-sources.md). The graded comparison against Chennai is in [parity-scorecard.md](parity-scorecard.md).

Gurugram is the ninth onboarded place. It needed **no new hero mode, no new place kind and no new
config primitive** - the first city in a while to add nothing structural. It did need one new panel,
and the reason is worth stating precisely.

## What Gurugram reused

| Concern | Existing primitive used | Why it fit |
|---|---|---|
| Hero | `heroMode: 'cauvery-pumping'` | The hero's actual shape is *water hauled a long way against installed capacity*. Gurugram lifts from the Yamuna at Kakroi ~70 km away into two plants. The mode name is Bengaluru-coded; the mechanic is not. |
| Groundwater | `groundwaterViews.exploitation` | The existing stage-of-extraction choropleth, at district rather than block unit. |
| Water bodies | the shared register + lost-bodies pair | No new component. |
| Origins | the shared chaptered story surface | Text-only, see below. |
| Place kind | `city` | Municipal Corporation of Gurugram, 36 wards. Not a region: unlike Mumbai's MMR or Kolkata's wetlands, Gurugram's water infrastructure is not outside its own boundary. |

The one thing that could not be reused was the tanker surface.

## Why Gurugram needed a third tanker kind

`tankerDataKind` had two values before this, and neither describes what GMDA publishes.

| Kind | City | The question it answers | Why it fails for Gurugram |
|---|---|---|---|
| `household-survey` | Bengaluru | *What do households pay?* | That market is private and RTI-gated, so it is surveyed. GMDA's is neither private nor surveyed. |
| `utility-ledger` | Hyderabad | *Who asks, and when?* | HMWSSB runs the fleet but **records no tariff**. Gurugram's rows are priced, and the price is the finding. |

What GMDA publishes is a third thing: a **sales ledger** with prices *and* a census of buyers. Every
row is a completed transaction with a tariff, a named buyer, a water grade and a filling station. So
the panel answers *what did the utility sell, to whom, and at what price?* - a question neither
existing kind can express.

### `utility-sales-ledger` - the new kind

`src/components/dashboard/tanker-sales-panel.tsx`, selected by
`tankerDataKind: 'utility-sales-ledger'`.

**The data**: 29,284 accepted bookings, **1,722,822,000 litres**, **Rs 8,72,49,778**, across 36
continuous months (2019-01-01 to 2021-12-31), 259 buyers, 5,287 delivery sites, 7 filling stations,
4 water types.

**The panel leads on composition, not volume**, and that choice is the whole design:

| | 2019 | 2020 | 2021 |
|---|---|---|---|
| Bookings | 12,336 | 9,740 | 7,208 |
| Litres | 799.4 M | 508.5 M | 414.9 M |
| Non-potable share | **29.7%** | 42.2% | **51.2%** |

Non-potable crossed half the market in three years while the three tariffs held flat - potable
~Rs 70.5/kL, recycled Rs 30, CETP-treated Rs 8. Stable prices mean the shift was not a price
response.

**But the panel does not let that stand as a recycling success story**, because it is not one. The
share moved because the potable side **collapsed 64%** (562 to 202 million litres) while non-potable
fell only ~10% (237 to 212 million). The market contracted; potable contracted much harder. The
panel prints the potable fall next to the share so a reader cannot take the first number without the
second, and the volume series carries its COVID caveat rather than leading with it.

This is the only transaction-resolution tanker data on the platform. Chennai, where the tanker
economy is most discussed, has none.

---

## Route inventory

Six of sixteen routes are live. The remaining ten are **switched off rather than shipped empty**,
each with a reason and a removal condition in `ROUTE_OFF_REASONS` (`scripts/lib/exemptions.ts`).

| Route | State | Measured content |
|---|---|---|
| `/gurugram` | live | 2 plants, 572 MLD |
| `/gurugram/groundwater` | live | 6 district polygons x 4 assessment years |
| `/gurugram/water-bodies` | live | 824 features, 2,851 acres; 29 lost bodies |
| `/gurugram/tanker` | live | 29,284 bookings, 36 months |
| `/gurugram/origins` | live | 6 chapters |
| `/gurugram/about` | live | per-page methodology |
| `/gurugram/rivers` | **off, permanent** | N/A - no river |
| `/gurugram/shoreline` | **off, permanent** | N/A - landlocked |
| `/gurugram/cascades` | **off, permanent** | N/A - johads are not a chained-surplus system |
| `/gurugram/my-ward` | off | 36 polygons harvested, 0 joined |
| `/gurugram/flood-risk` | off | 3 drainage legs; 117 waterlogging sites reachable |
| `/gurugram/lake-restoration` | off | inputs present, scorer not written |
| `/gurugram/climate-risk` | off | not built |
| `/gurugram/allocations` | off | no entitlement instrument located |
| `/gurugram/commitments` | off | not built |
| `/gurugram/facts` | off | blocked on the unverified demand numbers |

### `my-ward` was turned off after launch, not before

It shipped in the nav and rendered **296 characters** - a heading, a subtitle and a link, with no
selector, no map and no data. It was switched off on 2026-08-16 after a click-through found it.

That is worth recording rather than quietly fixing, because it is the clearest case of the platform
rule: **a route in the nav must have something in it, and a nav entry leading to an empty page is
worse than an absent one.** The 36 ward polygons are in the corpus; it is the attributes that are
missing.

---

## The defect class this city exposed

Gurugram shipped with six defects that lint, `tsc`, the test suite and every CI job passed cleanly:

1. the dashboard hero rendered **Bengaluru's** water system under Gurugram's name (the Cauvery, TK
   Halli, Kempe Gowda's kere network)
2. the supply panel cited **Madurai's** ADB Tamil Nadu Urban Flagship Investment Program
3. the footer named **CMWSSB**, Chennai's utility, as a core live source
4. the groundwater card promised a "live WRIS station overlay" for a city whose level series stopped
   in June 2020
5. the water-bodies card said "OSM polygons" for a layer that is GMDA's own statutory register
6. `my-ward` sat in the nav with 296 characters behind it

A seventh was found later: `/gurugram/rivers` rendered a badge reading **"parity: EASY"** for a city
with no river.

**Every one is the same shape: a shared component whose default is a fact about one specific city.**
"One shared component per feature" is the right rule, and each component had nonetheless accumulated
a default written for whoever it was built for. A ninth city inherits all of them at once.

The seventh is the worst of them, because `parityVerdict`'s own docstring says it should carry "a
source URL or research-memo reference" and it had degraded into a hardcoded constant, identical on
every city's page. The badge is now gated on the city having a published audit; Gurugram's is
[parity-audit.md](parity-audit.md).

### Why the usual checks missed all seven

| Check | Why it passed |
|---|---|
| Status codes | A page rendering another city's story returns 200 |
| Text-presence assertions | Asserting the **right** strings appear never asks whether wrong ones do |
| A hand-written blocklist | Can only catch leaks someone already found. "MMC" and "ADB Tamil Nadu" were not on it |

### The gate

`scripts/check-city-surfaces.py` renders every route a city advertises and runs four checks - LEAK,
EMPTY, CONSOLE, NULLISH. Its forbidden vocabulary is **generated from the city registry** rather than
hand-written: for city X, every other registered city's name, display name, authority acronym and
local-government acronym is a leak signal. That is generative, so it catches leaks nobody has seen
yet, including from cities added after it was written.

It also runs against a **control city**. A finding that reproduces on both is a harness bug, not a
city bug - a rule that caught three false findings during the Gurugram sweep, including one in the
gate's own DOM handling.

It is not wired into CI, which has no browser. It is a pre-cutover gate a human runs, and it is the
one that would have caught all six.
