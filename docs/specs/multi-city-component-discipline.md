# Multi-City Component Discipline

Status: adopted (June 2026). Applies to every feature page and every new city.

## Why this exists

The platform went Chennai-only -> Tamil Nadu -> pan-India. Chennai was built
first as flat routes (`src/app/<feature>/`) with Chennai data hard-coded; the
other cities were built on a shared dynamic route (`src/app/[cityId]/<feature>/`).
As we add cities (Mumbai, Delhi, ...), the cost of every divergence compounds.

This document is the rule we hold the line with: **a feature is one shared
component, and a city is data plus a config object - never a forked component
and never a scattered `if (cityId === "...")` in render code.**

If onboarding city N+1 means writing a new `<city>-content.tsx`, we have
already lost. Onboarding should be: add a config, drop in data files, flip
capability flags.

## The canon (already in the codebase - copy these)

These existing patterns ARE the discipline. New work extends them; it does not
invent a parallel mechanism.

- `PlaceConfig` (`src/lib/cities/types.ts`) - the single declarative source of
  truth per city.
- `groundwaterViews?: { exploitation, depth, risk, cgwbStations, iisc }` -
  per-city capability flags for the groundwater layers. "Honest-data-or-off":
  a view is only enabled where the underlying data supports the granularity it
  implies. This is the reference example for every other feature.
- `heroMode: 'days-left' | 'allocation' | 'cauvery-pumping' | 'none'` - a
  variant selector. The dashboard maps a declared mode to a hero component;
  multiple cities share each mode. This is how we pick between genuinely
  different renderers without a city-id switch.
- `urbanSupply`, `hasCascadeOverlay`, `basinIds`, `availableLanguages` -
  more declarative capability/config, defaulted so adding them is additive.

## The rules

1. **One shared component per feature.** It lives under
   `src/app/[cityId]/<feature>/` (server) and `src/components/<feature>/`
   (presentational). There is no `src/app/<feature>/` flat fork and no
   `<city>-content.tsx` that exists only to serve one city.

2. **City differences are declared, not branched.** The shared component reads
   capability flags off `config`. The only acceptable conditional is reading a
   flag (`config.waterBodies?.censusSource`), ideally abstracted behind a
   helper. `if (cityId === "chennai")` in a component is a smell and must be
   replaced by a flag.

3. **Variant selection uses a named key, not a city id.** When two cities need
   genuinely different renderers (e.g. an interactive flood map vs a narrative
   card stack), add a variant field to config (`flood.variant: 'interactive' |
   'narrative'`) and have the shared page map variant -> component. Any city can
   adopt any variant. `heroMode` is the template.

4. **Data paths are parametrized by `cityId`.** The convention is
   `<cityId>-<dataset>.geojson` / `<dataset>-<cityId>.json`. Shared components
   never contain a literal `chennai-*` path. Where a legacy unprefixed Chennai
   file still exists, the mapping lives in ONE place
   (`src/lib/cities/data-paths.ts`), never inlined per call site, and is tracked
   for rename.

5. **Honest-data-or-off.** A capability is enabled only where the data honestly
   supports it. Defaults are off / legacy so a new city lights up features as
   its data lands, and an unconfigured city silently degrades instead of
   throwing.

6. **New city onboarding = config + data + flags.** Adding a city must not
   require a new component. If it does, you have found a real new variant -
   add it to the variant map (rule 3) so it is reusable, not a fork.

## Anti-patterns (reject in review)

- A `<city>-content.tsx` whose only job is to serve one city.
- `if (cityId === "<city>")` inside JSX or render logic.
- A hard-coded `/geojson/chennai-*` (or any city) path in a shared component.
- A duplicated flat route (`src/app/<feature>/`) shadowing the `[cityId]` route.
- Copy-pasting a page for a new city instead of adding config.

## Capability flags added alongside this doc

Extending the canon to the pages converged in the Chennai-namespace migration:

- `dashboard?: { aiBriefing?, reservoirCatchmentContext?, groundwaterSnapshot? }`
  - extra dashboard sections, gated per city (Chennai is the first to have the
  data; the components are shared and any city can opt in).
- `facts?: { dynamicPipeline?: boolean }` - when true the facts page runs the
  live + derived builders at request time and merges them with the static
  layer; when false it loads the static `facts-<cityId>.json` snapshot.
- `flood?: { variant?: 'interactive' | 'narrative' }` - selects the interactive
  hazard/drainage/sewerage map vs the narrative card stack. The interactive
  renderer is city-agnostic and reads `<cityId>-flood-*` data.
- `waterBodies?: { censusSource?, rankingTab?, wardSearch?, lostBodies? }` -
  capability flags for the richer water-bodies surfaces.

## Migration status (Chennai)

Chennai is being converged off its flat fork onto the shared route as part of
the `/chennai` namespace migration. Legacy unprefixed Chennai data files
(`ward-names.json`, `restoration-priority.json`, `ward-profiles.json`) are
Chennai's; they are resolved through `src/lib/cities/data-paths.ts` and tracked
for rename to the `<cityId>-` convention.
