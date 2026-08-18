# Pune - Features

City ten, preview-gated. Sources behind each surface: `data-sources.md` alongside.
Build record: `docs/specs/pune-onboarding.md` (local).

## What kind of city this is

Pune impounds 29.15 TMC across four dams and still runs short, which makes it neither Chennai
(storage against demand) nor Gurugram (no storage at all). The Khadakwasla Complex is an
**irrigation project with a drinking-water share inside it** - 22.55 TMC of its 33.77 TMC of use is
the irrigation provision - so a days-of-water-left runway computed from total storage would credit
the city with water that is legally the canal's, in the middle of a live regulatory dispute about
exactly that.

## Shipped surfaces

| Route | Renderer | What it shows |
|---|---|---|
| `/pune` | `heroMode: 'cauvery-pumping'` | Supply-overview hero on PMC's own water budget, six reservoir cards, rainfall history |
| `/pune/groundwater` | shared block choropleth | 14 talukas x 6 IN-GRES editions + 120 telemetry station points |
| `/pune/water-bodies` | shared map | 791 OSM polygons, 84 named (7 pools/tanks excluded and counted) |
| `/pune/rivers` | shared `RiversClient` | 8 rivers with CPCB priority class and 2024 BOD per station |
| `/pune/my-ward` | shared | 41 named prabhags (needs ward/locality seeding to work) |
| `/pune/flood-risk` | shared narrative stack + `DrainageNetworkMap` | 3,075 nalla segments (1,014 km) over 8 rivers, 4 dated events, 6 stated gaps |
| `/pune/tanker` | **`delivery-register`** (new 4th kind) | 57,370 deliveries, the scheduled-vs-on-demand split, 7 filling points, partial prabhag attribution |
| `/pune/facts` | shared `FactsPage` (static snapshot) | 22 quotable cards across all four tiers, every figure read from a shipped artifact |
| `/pune/about` | shared + Pune section | Supply chain, what we track, what we do not |

## The hero: "The shortfall is smaller than the leak"

PMC publishes both halves of this in a single table of its ESR 2025-26:

| | MLD | TMC |
|---|---|---|
| net demand, 8,164,868 people | 1,110.18 | 14.308 |
| system losses at 32% NRW | + 522.19 | + 6.730 |
| **total requirement** | **1,631.84** | **21.030** |
| sanctioned entitlement | | 16.360 |
| **shortfall PMC reports** | | **4.670** |

The shortfall (4.67) is **smaller than the leak** (6.73). Eliminating non-revenue water would take
total requirement to 14.31 TMC against a 16.36 TMC entitlement - a 2.05 TMC surplus, without a drop
of new water. This is a subtraction across two rows of one PMC table, not a modelled claim.

Alongside it: the tap runs **four hours a day** against PMC's own 24-hour benchmark, unchanged in
every ESR edition since 2021-22, after Rs 1,557.89 cr of a Rs 2,818.46 cr equitable-supply project
with 67 of 82 service reservoirs built and **35 commissioned**.

## Groundwater - the strongest layer

**Pune is the first city on the platform to drill below the district**, because the district figure
says the opposite of the finding. Pune district totals **63.73% and reads SAFE**; **Shirur taluka
inside it is CRITICAL at 95.71%** and has been in all six published editions, never below 94.24%.
92.9% of Shirur's extraction is agriculture, so this is an irrigation story rather than a city one -
and agriculture is above 90% of extraction in 8 of the 14 talukas.

The 120 station points are drawn on the same map, and they carry their own finding: **exactly one is
inside the city boundary.** The rest instrument the eastern irrigation belt. That is why no per-ward
depth surface is offered.

`groundwaterViews`: `exploitation: true`, `depth: false`, `risk: false`, with a `gapNote` naming the
reason.

## Rivers - a self-contradiction inside one CPCB document

CPCB's October 2025 assessment records the Mula as **improved** (Priority I to II) while its own
Annexure XIV puts the Mula at Bopodi at **102.5 mg/L** BOD in 2024 - the sixth-highest of 756
locations nationally, above the worst Delhi Yamuna station (85.0) and above the Mithi at Mahim
(80.0).

The Mutha's gradient is the second story: **4.1 mg/L leaving Khadakwasla**, 32.5 at Deccan Bridge,
35.0 at Sangam, **50.2 at Veer Savarkar Bhavan**. The river does not arrive polluted.

The Mutha Right Bank Canal is drawn as an eighth "river" on purpose. It is the other claimant on the
same water, and Pune's entitlement argument is unreadable without it.

## Routes deliberately off

Each is recorded with its reason in `scripts/lib/exemptions.ts`, so an omission is never
indistinguishable from a bug.

- **`flood-risk`** - the event register is solid; Maharashtra WRD publishes Pune's flood lines as 518
  scanned PDFs and zero vectors.
- **`tanker`** - buildable and the highest-value remaining work. PMC publishes a real daily tanker
  register (409 XLSX since April 2026, per filling point, with ward, society and vehicle number).
- **`allocations`** - the instrument chain is documented but no measured annual draw exists since
  2017-18, and for that year the utility and the regulator disagree by 4.15 TMC.
- **`commitments`**, **`facts`**, **`origins`**, **`lake-restoration`** - buildable, not built.
- **`cascades`** - pipeline not run for Pune district. **`climate-risk`** - not built.
  **`shoreline`** - landlocked.

## Scope: PMC only

Pimpri-Chinchwad is a separate corporation of 181 sq km on its own Pavana source and publishes its
own ESR series - but **no PCMC ward boundary exists in any public form** (no OpenCity dataset,
GeoServer login-walled, no OSM polygon), so an MMR-style `region` place cannot be drawn honestly.
PMC over 41 prabhags is the Hyderabad shape, not the Mumbai one.

## Launch state

`enabled: false`. Before cutover: data-repo release for 12 artifacts → `corpus.lock` bump → apply
`044_pune_seed_disabled.sql` → first Pravah ingestion → seed wards/localities → flip `enabled` +
`045_pune_enable.sql`. Full checklist in the spec, §6.
