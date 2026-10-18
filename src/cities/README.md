# src/cities

One folder per city. Everything the app and the data pipeline need to know
about a city that is not data lives in its folder: its config, its written
content, and the settings its pipeline scripts read.

To add a city, follow [docs/cities/ADDING-A-CITY.md](../../docs/cities/ADDING-A-CITY.md).
This page is the reference for what goes in the folder.

## What goes in a city folder

| File | When | What it holds | Read by |
|---|---|---|---|
| `config.ts` | always | The city's `PlaceConfig` (`export default`): id, name, map frame, the routes it ships, its hero, water sources, feature flags. Types and field docs: [`src/lib/cities/types.ts`](../lib/cities/types.ts). | every page, through `src/lib/cities` |
| `about.tsx` | always | The About page's per-city slots (`export default`). It must fill `pages-1`. | `/<city>/about` |
| `about-pages.tsx` | usually | "What each page shows", imported by `about.tsx`. | `about.tsx` |
| `story-<lang>.tsx` | if `origins` is a route | The Origins long-read in one language (`export default`). `story-en.tsx` first; `story-ta.tsx`, `story-kn.tsx` and so on are added when a native-reviewed pass lands. | `/<city>/origins` |
| `rivers.ts` | if `rivers` is a route | `RIVERS`: river narratives, map frame, `defaultRiverId`. | `/<city>/rivers` |
| `flood.ts` or `flood.tsx` | if `flood-risk` is a route | `FLOOD`: the flood map layers or the narrative config. | `/<city>/flood-risk` |
| `my-ward.ts` | if `my-ward` is a route | `MY_WARD`: the source line under each card, and the city's own complaint portals and helplines. | My Ward cards |
| `routes-off.ts` | if any route is left out | `ROUTES_OFF`: why each route the city does not ship is off. | the exemptions register |
| `pipeline.json` | if a shared pipeline covers the city | Settings only Python scripts read: the IMD rainfall grid point, the provisional-rainfall point, IN-GRES assessment units, elevation bands, adjudicated cross-city mentions. The app never imports it. | `scripts/city_manifest.py` |

Copy the folder of the most similar city and edit it; that is quicker than
starting from the table.

Data files are not here. They are built into `public/data/<city>-*.json` and
`public/geojson/<city>-*.geojson` and shipped through the data repository (see
the guide). Per-city source registries (`scripts/source-registry/<city>.json`),
OSM layer rules (`scripts/osm-layers/<city>.json`), raw inputs
(`pipeline-inputs/<city>/`) and city docs (`docs/cities/<city>/`) also live
outside this folder, each in the directory of the tool that reads it.

## The generated index

`src/cities/generated/` is written by `npm run cities:gen`
([`scripts/gen-city-index.ts`](../../scripts/gen-city-index.ts)) from the folders.
Never edit it by hand. It holds:

- `ids.ts`: every city id, in `listOrder`.
- `registry.ts`: every `config.ts`, keyed by id.
- `pages.tsx`: the About and Origins loaders.
- `rivers.ts`, `flood.ts`, `my-ward.ts`, `routes-off.ts`: one map per optional module.
- `cities.json`: every config as plain JSON, for Python and workflows.

Run `npm run cities:gen` after adding a city, adding a story language or
changing a `config.ts`. `npm test` fails when the committed index is stale, and
says which file.

The same command appends the city's row to `schemas/nvdm/scopes.json` if it has
none. The row's parent is the state whose ISO 3166-2 code is `IN-<stateCode>`;
if that state is not registered yet, the command stops and tells you to add it.

## Python and workflows

```python
from city_manifest import configs, section   # scripts/ is on sys.path in pipeline scripts

configs()["kolkata"]["center"]                # any config.ts value
section("rainfall.imdGrid")                   # {city: value} for cities that have it
```

```bash
python3 scripts/city_manifest.py --ids                         # every city, list order
python3 scripts/city_manifest.py --ids --has elevationBands    # cities with that section
python3 scripts/city_manifest.py --get kolkata center          # one config value as JSON
```

In `pipeline.json`, `_note` and `_notes` keep the reasoning behind a value (why
this grid cell, why these assessment years). `section()` drops them before a
script sees the data, so write the why there rather than in the script.

## Rules

- **Per-city values live here, not in shared code.** If a shared component needs
  something city-specific, add a config field or a module. Never
  `if (cityId === "...")`, and never fall back to another city's value: a
  missing entry must render nothing.
- **Keep long copy out of `config.ts`.** Every page bundles every config, so
  prose and translations go in a module (`my-ward.ts`, `about-pages.tsx`).
- **A new kind of per-city content is one line.** Add it to `MODULES` in
  `scripts/gen-city-index.ts` (the file name, the constant it exports, its type)
  and the generator builds the map.
- **`listOrder` is the city's position in every list**, lowest first. Numbers go
  in tens, so a city can sit between two others (Nagpur is 95, between Pune's 90
  and Surat's 100); one added at the end takes the last number + 10.
