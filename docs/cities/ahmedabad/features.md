# Ahmedabad - Features

City eleven, live since 15 October 2026. Sources behind each surface: `data-sources.md`. Measured depth:
`parity-scorecard.md`.

## What kind of city this is

Ahmedabad drinks a canal and lives beside a river it no longer drinks from. 84% of AMC's supply comes
down the Narmada Main Canal from Sardar Sarovar; the Sabarmati, the river the city was founded on,
supplies none of it, and the reach through the riverfront is held by the Vasna barrage and topped up
from the same canal. Below the barrage the river is a CPCB Priority I stretch.

## Shipped surfaces

| Route | Renderer | What it shows |
|---|---|---|
| `/ahmedabad` | `heroMode: 'cauvery-pumping'` | AMC's own source table (Budget 2026-27), three live reservoir cards (Sardar Sarovar, Kadana, Dharoi) from the state's daily report, rainfall history, four tier-1 findings |
| `/ahmedabad/groundwater` | shared taluka choropleth + station overlay | 10 IN-GRES units on IN-GRES's own polygons, 5 editions; 139 telemetry stations |
| `/ahmedabad/rivers` | shared `RiversClient` | Sabarmati (10 stations, Kheroj to Vautha) and Khari; the Kharicut and Narmada Main Canal drawn for context |
| `/ahmedabad/flood-risk` | shared narrative stack | CWC thresholds at Subhash Bridge, the 1875 flood, July 2026, AMC's 148 spots, the gaps |
| `/ahmedabad/water-bodies` | shared map | 232 OSM polygons; ward search |
| `/ahmedabad/lake-restoration` | shared | 8 flagship lakes, 10 projects, 6 court orders |
| `/ahmedabad/my-ward` | shared | 48 wards from AMC's own map; water bodies, nearest river station, groundwater unit and nearest well; AMC's call centre and WhatsApp line |
| `/ahmedabad/commitments` | shared register | 10 dated commitments, 5 past their date |
| `/ahmedabad/facts` | shared (static) | 18 cards read from the artifacts |
| `/ahmedabad/origins` | shared story | 10 chapters, 1411 to the riverfront |
| `/ahmedabad/about` | shared + Ahmedabad section | What each page shows, every source |

## Off, with reasons (`scripts/lib/exemptions.ts`)

`allocations` (no public entitlement order), `tanker` (no register or survey), `shoreline`
(landlocked), `climate-risk` (not built).

## Launch state

Live since 15 October 2026 (`enabled: true`, `056_ahmedabad_enable.sql`). At cutover: the data-repo
release and `corpus.lock` pin; migrations 054 to 056; the dam history from 2019-06-07 in
`reservoir_daily_v2`, refreshed daily from the local scheduled job (the department's host does not
answer GitHub runners; each run re-reads the last 7 days, so a missed day is filled); a browser sweep
against Bengaluru; and every review-gated label verified, or labelled unverified where no current
status could be cited.
