# Kolkata - features and methodology

> Feature inventory for Kolkata, including how it differs from Chennai, Madurai, Bengaluru, Mumbai and Delhi. The data-source breakdown, with provenance for every file, is in [data-sources.md](data-sources.md).

Kolkata is the sixth onboarded place and the **second modelled as a region** (`placeKind: 'region'`),
after Mumbai's MMR. It is also the first place to need a **new hero mode**, and the reason is worth
stating precisely: the three existing heroes do not merely fit badly, one of them is mathematically
undefined here.

## Why Kolkata needed a fourth hero

| Hero | Why it fails for Kolkata |
|---|---|
| `days-left` | Divides live storage by draw rate. Kolkata has **no impounded storage at all** - supply is run-of-river Hooghly abstraction plus tube wells. The numerator does not exist. This is not "hard to compute", it is undefined: there is no volume to run down. |
| `cauvery-pumping` | Tells a lift-vs-design-capacity story (Bengaluru hauling water 100 km uphill). Kolkata's river runs through the city and Palta is ~22 km away on the same flat delta. There is no lift gap, and it is not what is wrong with Kolkata. |
| `allocation` | Entitled-vs-received against dam entitlements (Madurai's PWD letter). Kolkata's Hooghly abstraction is not a quota with a receipt; its binding constraints are upstream flow and treatment capacity. |
| `none` | Mechanically fine, but throws away the strongest material the research pass found. |

A hero on this platform is not just a big number. It is a **live, falsifiable figure with a divisor
the reader can move**. Kolkata has exactly one number of that shape, and it is not about scarcity.

## `drainage-capacity` - the new hero

`src/components/dashboard/drainage-capacity-hero.tsx`, selected by `heroMode: 'drainage-capacity'`
and configured by `drainageCapacity` on the place config.

**The claim.** KMC's own *Sewerage and Drainage* document states the main sewer network "was designed
to discharge a rainfall of **6 mm. per hour**". The hero asks how often the sky beats that.

**The answer**, from 232,896 hourly values (Open-Meteo archive, 2000-2025):

- long-run mean **31.8 hours a year** across 21.6 days
- **2000-2012 averaged 19.2 h/yr; 2013-2025 averaged 44.5** - the record splits cleanly in half
- 2025: 59 hours across 50 separate days
- wettest hour on record **40.2 mm** (22 Jul 2017), **6.7x** the design standard

**The movable divisor** is the threshold itself: a slider steps through a 10-value ladder (2 to
30 mm/h) and a year picker covers every complete year. Both are precomputed server-side into an
exceedance ladder rather than recomputed in the browser, so the payload is 30 KB instead of ~230k
hourly values.

**Design decisions worth keeping:**

- **The standard is config, not a constant.** `drainageCapacity.standardMmPerHour` with a cited
  `standardSource`. Two reasons: it varies by city (modern Indian storm-water codes use 12-25 mm/h,
  so this hero generalises well beyond Kolkata), and Kolkata's own figure comes from a 2009 document
  describing Victorian brick sewers - if a rehabilitated stretch carries a different rating, that is
  a config edit and a re-cited source, not a code change.
- **Part-years are excluded** from the year picker. An unfinished year reads as a fall in exceedance
  when it is just unfinished. 2026 is in the data and out of the picker.
- **Both caveats render on the face of the hero**, not in a tooltip: that the standard is quoted from
  a document (with a link to it), and that ERA5-family reanalysis smooths short convective bursts so
  every count is a **lower bound**, not a rain-gauge reading.

**PRE-PUBLICATION GATE.** The 6 mm/hour figure must be confirmed against a KEIIP document before this
hero goes public. It is a design property rather than a perishable statistic, but post-KEIIP
rehabilitated stretches may carry a different standard.

## The new ingest: hourly rainfall intensity

`neer-vazhvu-api/scripts/fetch_rainfall_intensity.py` -> `public/data/rainfall-intensity-kolkata.json`.

Every previous rainfall product on the platform is a monthly or daily **total**, which is the wrong
unit for drainage: a drain does not fail because 120 mm fell in a day, it fails because 30 mm fell in
an hour. This is the platform's first sub-daily rainfall product, and it is deliberately generic -
the ladder spans the 12-25 mm/h range other cities' codes use, so adopting this hero elsewhere is a
config entry plus a coordinate.

## The independent check

The hero is modelled; the **KMC weekly waterlogging register is observed**. One says reanalysis
rainfall beat the standard for N hours; the other says which streets KMC actually sent de-silting
machines to. The product carries both rather than letting one stand in for the other, and the hero
deep-links to the register.

`scrape_kmc_drainage_register.py` + `.github/workflows/kmc-drainage-refresh.yml`. The 2026-07-20
edition parses to **329 rows, 66 distinct pockets, 53 wards, 15 boroughs**, every pocket carrying a
borough/ward attribution.

**This job is an archive, not a refresh.** KMC overwrites the file in place every week at a fixed
URL, so there is no upstream history: a missed week is permanently lost from the public record. The
weekly job is the only thing creating a Kolkata waterlogging time series.

## Scope: region, with a deliberately narrow unit set

The scope decision is **physical, not administrative**. The East Kolkata Wetlands treat 910 of
Kolkata's 1,400 MLD of sewage - 65%, roughly 5x what all five of the city's STPs manage combined -
and the EKW lies **outside KMC**, in North and South 24 Parganas. A KMC-only Kolkata would draw a
boundary excluding the city's single largest piece of water infrastructure.

But the region models only **three** units, not the ~38 municipalities of the Kolkata Metropolitan
Area, because KMA structure is not established to primary (the 3-vs-4 corporation count is
unresolved; KMDA's site did not yield figures). The units seeded are the ones whose **water
relationship to KMC is individually verified**: KMC itself, and the two bodies it sells bulk water to
(Bidhannagar 90 MLD, Budge Budge 22.7 MLD - both ready-made Allocation Ledger rows). The rest of KMA
is a named gap on the scope card, not a silent omission. Units join as their relationships are
verified, which is the discipline the MMR build followed.

## The sewage balance

From KMC's own District Environment Plan 2021, filed under the NGT-mandated DEP process. The
transcription is **validated against arithmetic the document itself prints** - capacities must sum to
KMC's stated 280.06 MLD, 910+179 must equal 1,089, 1,400-1,089 must equal 311, and 311/1,400 must
equal the stated 22.21%. A mistyped figure fails the build. This is deliberate: the STP table is a
five-level nested layout that pdftotext flattens irrecoverably, so a positional parser would fail
*silently*, which is the worst failure mode for a numbers surface.

10 upcoming STPs totalling 280.06 MLD, **9 with coordinates**, so they map directly. Even if every
one is built, that is 280.06 MLD of new capacity against 311 MLD currently untreated: a residual gap
of 30.94 MLD, assuming the wetlands keep treating 910 MLD.

**Correction to the pre-onboarding research:** it recorded 11 upcoming plants. There are 10, and they
sum exactly to the document's printed total.

## Two numbers we deliberately do not publish

- **No total supply capacity.** KMC's own page lists plants summing to 2,324.7 MLD while
  simultaneously describing a ~1,900 MLD target and ~1,660 MLD requirement, is labelled "(DRAFT)",
  and is footered 2013. Per-plant figures are carried as design capacities and never summed until
  this reconciles against KMC's budget statements.
- **No LPCD.** `defaultConsumptionMld` is `null`. KMC contests its own denominator: 4.5 million
  residents plus a 6-million/day floating population in one document, a "static population" of
  44.96 lakh in another. Every LPCD figure for Kolkata is unstable at the source.

## What is off at launch, and why

- **`my-ward` and all ward surfaces.** Ward geometry is 141 of 144 (OpenCity's KML has 1-141;
  142/143/144 absent) with a bare ward number as the only attribute - no name, no borough. A partial
  ward layer that silently drops three wards is worse than none.
- **Per-ward groundwater depth.** 667 stations across KMA is dense (denser than Delhi's 237), but
  count is not coverage. Howrah has been quiet since Apr 2023 and Hooghly since Nov 2022; those must
  render as stale, not be interpolated over.
- **`cascades`** (not a cascade geography), **`shoreline`** (the riverbank/estuary variant is a
  different surface and is unbuilt), **`tanker`** (KMC runs a municipal tanker service with published
  per-trip rates but publishes no volumes).
- **Bengali UI.** `availableLanguages: ['en']`, `upcomingLanguages: ['bn']`. The drainage-hero strings
  are English-only; entries are partial by design and fall back to `en`.
- **IMD rainfall backbone.** Not yet ingested, so the provisional-fill feed cannot run. Carried as an
  explicit, temporary entry in `check-data-freshness.ts` EXEMPTIONS with a removal condition, not
  silently skipped.

## Still to build

- **WBPCB EMIS scraper.** The strongest Kolkata data find and the largest remaining piece: a 12-year
  quarterly series across 28 Kolkata stations, including the Adi Ganga at six points each sampled at
  **high tide and low tide** separately. The flow is fully worked out and re-verified (HTTP 200, no
  login) and registered in Headwaters with an empty `dependsOn` until the file exists.
- **`tidalPhase` on river stations.** The high/low-tide pairing is unique on the platform and is the
  correct way to model a tidal river. It should be a shared dimension, not a Kolkata-only field.
- **EKW as a first-class place**, not a map layer. It is the city's largest treatment asset.
