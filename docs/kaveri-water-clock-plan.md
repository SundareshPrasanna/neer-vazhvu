# Kaveri Water Clock - Implementation Plan

Last updated: 2026-04-25
Status: planning, no code yet
Branch policy: V1 builds on `kaveri_onboarding`; V1.5 builds on `kaveri_infrastructure`. Main auto-deploys to Vercel; do not merge to main until end-to-end validated.

---

## 0. Strategic context

**What this is.** A read-only public dashboard for the Kaveri Delta region of Tamil Nadu, living inside the existing neer-vazhvu platform as a `/cauvery` subroute. Reuses the multi-city source registry being built for Bangalore. Embed-friendly so journalists can pull charts into stories.

**Audience.** Action-takers, NOT farmers directly:
- Agri-policy journalists (validated DT Next April 2026 cite is the entry pattern)
- TN agri-dept officers, FPO secretaries (~30-50 per district), KVK scientists
- DHAN / MSSRF / WELL Labs staff
- Government planners

Direct-to-farmer reach is explicitly NOT the play. Distribution to farmers, when it comes, is curated push insights only - not a dashboard for farmers to navigate. Last-mile via TNAU DAMU, FPO secretaries, KVK WhatsApp, AIR, Sun News.

**Two questions the dashboard answers.**
1. *Is there water this season?* (Mettur + Karnataka + Biligundlu + monsoon) - V1
2. *Even if there is, can it reach the field?* (1934-era infrastructure, 45% conveyance efficiency) - V1 anchors with structural context; V1.5 builds the full layer

**Killer signal.** "Will Mettur dam open on June 12, the customary release date for the kuruvai paddy season?" Everything in V1 serves this question or its corollaries.

**Build constraint.** 1-2 person team. ~10-13 weeks for V1; ~6 additional weeks for V1.5. Runs in parallel with `bangalore_onboarding` (which is in waiting/research mode pending foundation funding).

---

## 1. Architecture fit

### 1.1 Place model: Region, not City

The existing registry is keyed by a single municipal authority and ULB with a wardCount. The Kaveri Delta has none of those - it spans Salem, Erode, Karur, Tiruchi, Thanjavur, Tiruvarur, Nagapattinam, Mayiladuthurai, Cuddalore districts; the actionable jurisdictions are TN PWD (dam ops), CWMA (release schedule), Agriculture Dept (paddy season).

Decision: introduce `RegionConfig` as a sibling to `CityConfig` in `src/lib/cities/`. New file `src/lib/cities/kaveri.ts` exporting a `RegionConfig`, register in `src/lib/cities/index.ts`. Mirror in Python at `neer-vazhvu-api/app/cities/kaveri.py`. Shared interface `Place` with a `placeKind` discriminator. Schema-wise, add a `place_kind` column to `cities` (default `'city'`); keep the table named `cities` for V1; rename in a future migration.

Rejected alternative: forcing Kaveri into `CityConfig` with primaryAuthority="PWD" and a fake ward count. Violates existing semantics and would mislead the Bangalore work.

### 1.2 New source registry entries

These extend the `WaterSourceType` enum at `src/lib/cities/types.ts` (which already contains `cauvery_stage` - a tell that this was anticipated).

| sourceCode | type | feasibility | cadence |
|---|---|---|---|
| `mettur` | `reservoir` | high - TN PWD bulletin HTML, scrape pattern matches CMWSSB | daily ~07:30 IST |
| `krs`, `kabini`, `hemavathy`, `harangi` | `reservoir` (new flag `state='KA'`) | high - KSNDMC `Reservoir_Details.aspx` is a clean target | daily |
| `biligundlu` | new type `flow_station` (add to enum) | mixed - no machine feed; CWC daily station bulletin best-effort | manual override + best-effort daily scrape |
| `cauvery_basin_imd` | new type `rainfall_basin` (add to enum) | high - `imdlib` already in API stack; CHIRPS via existing GEE pipeline | daily, T-1 lag |

The `flow_station` enum addition needs to relax the SQL CHECK constraint at `supabase/migrations/017_cities_and_water_sources.sql:34`.

### 1.3 Database schema (migration `018_kaveri_water_clock.sql`)

Pick **new tables**, not extending `reservoir_daily`. Justification: `reservoir_daily` is keyed `(reservoir, date)` against the Chennai-specific `ReservoirName` enum at `src/types/reservoir.ts`. Squeezing Mettur/KRS into it forks the enum city-by-city. Coordinate with `bangalore_onboarding` if it makes the same call so we share table names.

Tables:
- `place_kind` column added to `cities` (defaults `'city'`). Insert row `('kaveri', 'Kaveri Delta', 'TN', ...)` with `local_gov_acronym=NULL`.
- `reservoir_daily_v2` (or whatever Bangalore named it): `(city_id, source_code, date)`. Columns: storage_tmc, storage_pct_frl, level_ft, inflow_cusecs, outflow_cusecs, scraped_from.
- `flow_station_daily`: `(city_id, source_code, date, cumulative_tmc_ytd, cumulative_normal_tmc_ytd, source_method enum 'auto_scrape'|'manual_admin', priority int, source_url, note)`.
- `basin_rainfall_daily`: `(city_id, basin_code, date, rainfall_mm, lpa_mm, source enum 'imd'|'chirps'|'gee')`.
- `mettur_release_signal`: `(date, signal enum 'likely'|'uncertain'|'unlikely', model_version, inputs_jsonb)`.
- `delta_infrastructure_assets`: static seed for the V1 timeline visual.
  ```sql
  CREATE TABLE delta_infrastructure_assets (
    id text primary key,
    name text not null,
    asset_type text check (asset_type in ('dam','anicut','barrage','canal_main','regulator')),
    built_year int not null,
    builder text,
    last_restored_year int,
    current_status text check (current_status in ('operational','collapsed','rebuilding','decommissioned')),
    design_discharge_cusecs int,
    current_efficiency_pct numeric,
    latitude numeric,
    longitude numeric,
    citation_url text
  );
  ```
- `delta_capex_projects`: static seed for the V1 timeline visual.
  ```sql
  CREATE TABLE delta_capex_projects (
    id text primary key,
    scheme_name text not null,
    sanctioned_year int,
    sanctioned_amount_cr numeric,
    financier text,
    status text,
    scope_km numeric,
    completed_year int,
    citation_url text
  );
  ```

Both seeded once from the infrastructure research dossier; no recurring ingestion.

### 1.4 Routing - `/cauvery` subroute

Following the existing `src/app/groundwater/` and `src/app/flood-risk/` patterns:

```
src/app/cauvery/
  page.tsx                    # Water Clock landing
  layout.tsx                  # narrower header (no city switcher), embed-safe wrapper
  release-signal/page.tsx     # June 12 deep-link with rules-model breakdown
  embed/
    mettur/page.tsx           # iframe-safe single-chart route
    karnataka-dams/page.tsx
    biligundlu/page.tsx
    basin-rainfall/page.tsx
  api/
    snapshot/route.ts         # JSON for embeds and partner journalists
```

Add to `TOP_NAV` in `src/components/layout/header.tsx` only **after** V1 launch. `next.config.ts:21` `X-Frame-Options: DENY` blocks iframes; embed routes need their own header override (per-route or middleware).

V1.5 adds `src/app/cauvery/infrastructure/page.tsx` as a sibling.

---

## 2. Data ingestion (per source)

All scraper modules under `src/lib/scrapers/` (TS) for parity with `cmwssb.ts`. Python counterparts at `neer-vazhvu-api/app/scrapers/` only when GitHub Actions IP is needed (CMWSSB pattern - `daily-data-pipeline.yml` runs Python from Actions because Vercel egress IPs are sometimes blocked by gov sites).

### 2.1 Mettur

- **Endpoint**: `https://www.tnagriculture.in/ARS/home/reservoir` (HTML table). Cross-check: oneindia.com tracker, smarttrichy.com.
- **Library**: `cheerio` (already in `package.json`). New file `src/lib/scrapers/tn-pwd-mettur.ts`, mirror `cmwssb.ts` structure.
- **Storage**: `reservoir_daily_v2` row with `city_id='kaveri'`, `source_code='mettur'`.
- **Cadence**: daily ~07:30 IST cron, after TN PWD bulletin posts.
- **Failure mode**: same `pipeline_log` insert pattern as `src/app/api/cron/scrape-cmwssb/route.ts`. Stale tolerance 4 days (CMWSSB precedent).

### 2.2 KSNDMC 4-dam (KRS, Kabini, Hemavathy, Harangi)

- **Endpoint**: `https://www.ksndmc.org/Reservoir_Details.aspx`. ASPX postback may need a session - try GET first, fall back to `httpx`-based Python scraper if cookies are required.
- **Library**: `cheerio` first try. Fallback: `neer-vazhvu-api/app/scrapers/ksndmc.py` from GitHub Actions like `scrape_cmwssb.py`.
- **Storage**: four rows in `reservoir_daily_v2` per day. Add `state_code` column on `water_sources` so charts can label "Karnataka 4-dam total" without hardcoding source codes in UI.
- **Cadence**: daily ~07:30 IST.
- **Failure mode**: India-WRIS as explicit fallback fetcher, only invoked if KSNDMC scrape returned 0 rows. Log path used in `pipeline_log.step` (`ksndmc_scrape` vs `ksndmc_wris_fallback`).
- **Karnataka cumulative-vs-normal-year curve**: requires one-time backfill of 5+ years of daily storage. Source: KSNDMC archive or India-WRIS bulk export. Separate `scripts/backfill-karnataka-dams.ts` ad-hoc script - not a recurring job.

### 2.3 CWMA Biligundlu YTD

The politically charged one. No machine-readable feed exists.

- **Storage**: `flow_station_daily` keyed `(city_id, source_code='biligundlu', date)`.
- **Manual override path**: tiny admin-only form at `src/app/admin/cauvery/biligundlu/page.tsx` (auth via existing Supabase admin pattern - see `src/lib/supabase/admin.ts`). Form takes `(date, cumulative_tmc_ytd, source_url, note)` and writes with `source_method='manual_admin'`. Single ops user (Sundaresh) updates during distress months.
- **Auto-scrape path** (best-effort): scrape `central-water-commission.gov.in`-style daily bulletin URLs. Mark `source_method='auto_scrape'`. Manual entries are authoritative when both exist - DB unique on `(city_id, source_code, date)`; `priority` column where `manual_admin > auto_scrape`.
- **CWMA monthly schedule**: hardcoded in `src/lib/cauvery/cwma-schedule.ts` - 12 monthly target TMC values from the 2018 SC final order. Almost never changes. Don't put in DB.
- **Failure mode**: stale-data badge in UI ("last updated DD/MM, manual entry"). Never silently fall back to last year's value.

### 2.4 IMD basin rainfall

- **Library**: reuse `imdlib` in `neer-vazhvu-api/scripts/generate_imd_rainfall.py`. Chennai script targets a single grid point; basin version averages across all grid points within the Cauvery basin polygon.
- **Implementation**: new script `neer-vazhvu-api/scripts/generate_kaveri_basin_rainfall.py`. Loads Cauvery basin GeoJSON (acquire from India-WRIS - open decision), masks IMD 0.25° grid by polygon, area-weighted-averages, writes daily SW (Jun-Sep) and NE (Oct-Dec) cumulative totals. Output to `basin_rainfall_daily` table (not static JSON like Chennai pattern - need cumulative-YTD-vs-LPA charts that update daily).
- **Cadence**: daily, runs in Actions. Verify the IMD daily realtime endpoint behaves differently from the archive endpoint flagged in `generate_imd_rainfall.py:35`.
- **Failure mode**: CHIRPS via GEE as hard backup. If IMD is down >7 days, surface "rainfall from CHIRPS" provenance in UI - never silently swap.

### 2.5 CHIRPS (backup/verification)

- Reuse the GEE service-account auth at `gee-phase1.yml`. New script `neer-vazhvu-api/scripts/run_kaveri_chirps.py`. Cadence: weekly is enough for backup.

### 2.6 Sentinel-1 paddy mapping

Out of scope for V1. Deferred to V1.5+.

---

## 3. UI components

### 3.1 Reusable from existing repo

- **`Card`, `CardContent`** at `src/components/ui/card.tsx` - reuse directly.
- **`StorageTrendChart`** at `src/components/dashboard/storage-trend-chart.tsx` - Recharts area+line with multi-year comparison. The KSNDMC cumulative-vs-normal chart is a thin wrapper around this; `comparisonYears` prop is what we need.
- **`ReservoirCards`** at `src/components/dashboard/reservoir-cards.tsx` - storage-pct bar with green/yellow/orange/red color logic. Reuse for Mettur and Karnataka 4-dam cards.
- **`DaysLeftHero`** at `src/components/dashboard/days-left-hero.tsx` - structure (big number + slider + scenarios) is the right metaphor for the June 12 countdown. Don't reuse literally - math is Chennai-demand-specific. Copy layout, write new logic.
- **`RainfallTrends`** at `src/components/dashboard/rainfall-trends.tsx` - bar chart with normal-line reference.
- **`Header` / `Footer`** at `src/components/layout/` - reuse but consider `cauvery-header.tsx` variant that drops `/my-ward` link (no wards) and adds "Region: Kaveri Delta" pill.
- **`recharts`** is the charting lib (already in `package.json`).
- **Date utilities**: `formatDate` from `src/lib/utils/format.ts`, `todayIST` from cron routes.

### 3.2 New components

- `src/components/cauvery/release-countdown-banner.tsx` - June 12 hero. States: countdown (`T-N days`), released-on (`Released on DD MMM`), overdue (`Day +N, not yet released`).
- `src/components/cauvery/release-signal-card.tsx` - Y/N/uncertain badge with rules-model inputs expanded on click.
- `src/components/cauvery/mettur-status.tsx` - current TMC, % FRL, % of release threshold, inflow/outflow. Includes the **45% conveyance efficiency context strip**.
- `src/components/cauvery/karnataka-dams-summary.tsx` - 4 small cards + cumulative-vs-normal-year chart.
- `src/components/cauvery/biligundlu-realisation.tsx` - YTD bar with monthly schedule overlay; "manual entry" badge.
- `src/components/cauvery/basin-rainfall-chart.tsx` - SW + NE cumulative vs LPA.
- `src/components/cauvery/delta-timeline.tsx` - **the "When was this built?" horizontal timeline visual** (V1 addition). Static SVG/Recharts; data from `delta_infrastructure_assets` + `delta_capex_projects` seed.
- `src/components/cauvery/embed-chrome.tsx` - minimal iframe-safe wrapper. No header, no nav. Chart + "Source: neervazhvu.org/cauvery" attribution + last-updated stamp.

### 3.3 Page layout (text wireframe)

```
/cauvery
+----------------------------------------------------------+
|  [Cauvery header strip: "Kaveri Delta · TN/KA"]          |
|                                                          |
|  +-- ReleaseCountdownBanner (full width) ------------+   |
|  |  T-48 days to customary kuruvai release           |   |
|  |  Release likelihood: LIKELY · view inputs         |   |
|  +----------------------------------------------------+   |
|                                                          |
|  +-- MetterStatus -+  +-- KarnatakaDamsSummary ------+   |
|  |  Mettur 47.2 TMC|  | KRS 28 · Kabini 11 ...       |   |
|  |  50.5% FRL      |  | 4-dam total: 62.4 TMC         |   |
|  |  94% release thr|  | vs 78.1 TMC normal-Apr        |   |
|  |  ~45% reaches   |  | [cumul-vs-normal chart]       |   |
|  |  field (TN WRD) |  |                               |   |
|  +-----------------+  +-------------------------------+   |
|                                                          |
|  +-- BiligundluRealisation (full width) -------------+   |
|  |  YTD: 89.3 TMC delivered KA->TN                   |   |
|  |  vs CWMA YTD schedule: 71.2 TMC (over by 18.1)    |   |
|  |  [bar chart by month]   [manual entry · 22 Apr]   |   |
|  +----------------------------------------------------+   |
|                                                          |
|  +-- BasinRainfallChart (full width) -----------------+   |
|  |  SW monsoon cumulative + NE cumulative + LPA      |   |
|  +----------------------------------------------------+   |
|                                                          |
|  +-- DeltaTimeline (full width) ----------------------+   |
|  |  When was this built?                             |   |
|  |  [Kallanai 150 CE -- present unbroken]            |   |
|  |  [Mukkombu 1838 -- 2018 break -- 2024 rebuild]    |   |
|  |  [Lower Anicut 1830s]                             |   |
|  |  [Mettur 1934] [Grand Anicut Canal 1934]          |   |
|  |  Post-1947 capital: [IAMWARM] [ADB] [ERM]         |   |
|  +----------------------------------------------------+   |
|                                                          |
|  Methodology · Sources · Embed these charts            |
+----------------------------------------------------------+
```

### 3.4 Embed format

**Both, scoped clearly:**

- **iframe routes** at `/cauvery/embed/<chart>` - strip global `X-Frame-Options: DENY` (`next.config.ts:21`) for this path prefix only via per-route `headers()` override or middleware (`src/middleware.ts` exists). Set `Content-Security-Policy: frame-ancestors *` for embeds; keep `DENY` everywhere else.
- **Open Graph cards** for social-media share - the `src/app/api/og/` directory already exists. Add `src/app/api/og/cauvery/release-signal/route.ts`.

Each chart shows an "Embed this chart" link that copies the iframe snippet to clipboard.

---

## 4. The June 12 model

A simple rules-based AND/OR cascade. **Hardcoded constants** in `src/lib/cauvery/release-signal-model.ts`. Justification: one model, one team, no need to A/B-test or let non-engineers edit. Future v2 with multiple model versions moves to DB.

Pure function `computeReleaseSignal(inputs): { signal: 'likely' | 'uncertain' | 'unlikely', reasons: ReasonRow[] }`.

### 4.1 Inputs (gathered by section 2 ingestion)

- Mettur storage TMC and `% of release threshold ~50 TMC`
- Karnataka 4-dam total TMC and `% of normal-for-this-day-of-year`
- Cauvery basin SW-monsoon cumulative rainfall to date and `% of LPA-to-date`
- IMD seasonal forecast for SW monsoon (manual entry, updated monthly when IMD publishes - admin form similar to Biligundlu manual path)

### 4.2 Rules (illustrative - calibrate before launch)

- `signal = 'likely'` if Mettur >= 50 TMC by June 1 OR (Karnataka 4-dam >= 90% of normal-day AND basin rainfall >= 80% LPA AND IMD forecast not 'below normal')
- `signal = 'unlikely'` if Mettur < 35 TMC by June 1 AND Karnataka 4-dam < 70% of normal-day
- `signal = 'uncertain'` otherwise

### 4.3 Transparency

Each rule fires a `ReasonRow { metric, value, threshold, met }`. UI shows inputs in a "view inputs" expander on the release-signal card so a journalist can see exactly why the page says what it says. **This is the single most important transparency feature for the journalist audience.**

### 4.4 Execution

Model runs **once daily** in cron (`src/app/api/cron/cauvery/compute-release-signal/route.ts`) after all upstream ingestions complete; writes to `mettur_release_signal` table. The page reads from that table - never recomputes at request time, so journalists hitting the page mid-update never see flicker between rule states.

---

## 5. Infrastructure dimension - V1 anchors and V1.5 page

### 5.1 V1 anchors (in scope for first launch)

Two small additions that fold the structural story into V1 itself:

**A. The "When was this built?" timeline strip.** Static visual described in 3.2 above. Effort: ~3 days. Anchors every Mettur-release news cycle in the fact that no new trunk infrastructure has been built in the delta since 1934.

**B. The 45% conveyance efficiency context strip.** Permanent label on the Mettur status card: "Of every 100 TMC released into the Grand Anicut Canal, ~45 reaches the field. Source: TN WRD." Hyperlinked to a methodology footnote. Hardcoded in `src/lib/cauvery/constants.ts` with citation. Updated when ERM completes (target 62%). Effort: ~1 hour.

### 5.2 V1.5 - `/cauvery/infrastructure` page

Sibling page shipped 4-6 weeks after V1 launch on its own theme branch (`kaveri_infrastructure`). Five sections:

1. **Conveyance efficiency map** - current 45% Grand Anicut + Sentinel-1 SAR head-vs-tail water-presence proxy for Vennar/Vettar/Pullambadi (no published number for these)
2. **Ayacut shrinkage** - block-level designed vs actually-irrigated area from TN DES Season & Crop Reports, multi-year heatmap
3. **Last-desilted reach map** - OSM canal segments coloured by last-desilting year from Kudimaramathu disclosures + RTI data
4. **Breach repair lag** - per-event timeline of breach -> WRD-reported-completion, scraped from news + WRD press releases
5. **Encroachment compliance** - Madras HC water-body register status by district, PSAZ Act compliance

Indicators where data is open ship in V1.5; the rest get placeholder cards with "data not yet available - we are working with partners" tags. Honest, and creates pressure on closed sources.

Schema for V1.5 indicators (canal segment desilting, breach events, encroachment compliance) gets added in a later migration once partnerships are closer.

### 5.3 Why this dimension matters

The structural story is that the entire delta trunk irrigation system is colonial or older (Kallanai 150 CE; Upper/Lower Anicut 1836 Cotton; Mettur 1934) with essentially zero new build post-1947, and Grand Anicut Canal currently runs at 45% conveyance efficiency. This shifts the narrative from "is there water" to "even if there is, can it reach the field?" That's the original story this dashboard tells.

See `kaveri_delta_infrastructure_research.md` memory for verified facts and citations.

---

## 6. Milestones

Seven milestones. M1-M5 are V1 (~10 weeks). M6 is launch (~2 weeks). M7 is V1.5 (~6 weeks, starts after V1 launch).

### M1 - Foundation (week 1-2). Independent of Bangalore.

- Cut `kaveri_onboarding` branch off `bangalore_onboarding` (inherits in-flight refactor; if Bangalore lands first, rebase onto main)
- Migration `018_kaveri_water_clock.sql`: `place_kind` column, `reservoir_daily_v2`, `flow_station_daily`, `basin_rainfall_daily`, `mettur_release_signal`, `delta_infrastructure_assets`, `delta_capex_projects`. Seed `cities` with `'kaveri'` row. Seed both infrastructure tables from the research dossier.
- TS + Python region registries: `src/lib/cities/kaveri.ts` + `neer-vazhvu-api/app/cities/kaveri.py` with all 5 reservoir source codes and the Biligundlu flow station.
- Skeleton `/cauvery` route returning hardcoded mock data.
- **Demo**: visit `/cauvery` on theme branch deploy preview; see static numbers in the right layout.

### M2 - Mettur + KSNDMC ingestion (week 3-4). Depends on M1.

- TS scraper `tn-pwd-mettur.ts` + cron route. Manual test with Vercel preview hitting prod CRON_SECRET.
- KSNDMC scraper, falling back to Python+Actions if Vercel IP is blocked (mirror `daily-data-pipeline.yml`).
- Wire `MetterStatus` and `KarnatakaDamsSummary` components to live data.
- **Demo**: real Mettur and Karnataka numbers updating daily on theme deploy.

### M3 - Basin rainfall + CHIRPS backup (week 5-6). Depends on M1, parallelizable with M2.

- `generate_kaveri_basin_rainfall.py` - IMD daily pull, basin polygon mask, write to `basin_rainfall_daily`.
- CHIRPS GEE backup script under `neer-vazhvu-api/app/gee/`.
- `BasinRainfallChart` component live.
- **Demo**: cumulative SW rainfall vs LPA chart updating daily; provenance badge correctly switches IMD <-> CHIRPS in test.

### M4 - Biligundlu + admin form + release model (week 6-7). Depends on M1.

- Best-effort CWC scraper (low confidence, ship even if it returns nulls 80% of days).
- Admin form at `/admin/cauvery/biligundlu`.
- IMD seasonal forecast admin form.
- `release-signal-model.ts` + cron + `mettur_release_signal` table writes.
- `ReleaseSignalCard` with the input expander.
- **Demo**: signal value visible on page with all four inputs reasoned out; manual entry round-trip works.

### M5 - Embeds + OG + countdown banner + infrastructure anchors + polish (week 8-9).

- `/cauvery/embed/*` routes with frame-ancestors override (touches `src/middleware.ts` and `next.config.ts`).
- OG image generators under `src/app/api/og/cauvery/`.
- Countdown banner with three states.
- **Delta timeline visual** (V1 anchor A).
- **45% conveyance efficiency strip on Mettur card** (V1 anchor B).
- Empty-state and stale-data UX (badges).
- "Embed this chart" copy-paste snippets.
- Run user-facing copy past the no-em-dashes rule.
- **Demo**: a journalist can iframe a chart into a CodePen and OG card previews correctly in Twitter/Slack.

### M6 - Validation, journalist preview, launch (week 10-12).

- Hand 2-3 journalists (DT Next April 2026 contact + 1-2 others) a preview link, capture feedback.
- Brief TN agri-dept officer / DHAN / MSSRF contact list with pitch in `docs/journalist-pitch-adhanoor-2026-04.md` style.
- Add `/cauvery` to header nav in `src/components/layout/header.tsx`.
- Merge `kaveri_onboarding` -> main (auto-deploys to Vercel).
- **Demo**: public launch announcement; first journalist citation.

### M7 - V1.5 Infrastructure page (week 13-18). Starts after V1 launch.

- Cut `kaveri_infrastructure` from main.
- Migration `019_kaveri_infrastructure.sql` for canal segment data, breach events, encroachment compliance.
- Build the five sections (5.2 above). Open-data indicators ship live; partnership-blocked indicators ship as placeholder cards with "we are working with partners" tags.
- Sentinel-1 head-vs-tail SAR pipeline (new, but builds on existing GEE service-account pattern).
- OSM canal segment join with desilting records.
- News scraping pipeline for breach repair lag.
- **Demo**: `/cauvery/infrastructure` live; press release about the structural story.

### Honest dependencies

M1 needs the `reservoir_daily_v2` shape locked. If Bangalore is in flight when M1 starts, either (a) wait for the schema to settle (likely 1-2 week slip) or (b) coordinate the schema design with whoever owns Bangalore so both branches use the same table name and key shape. M2-M5 are independent of Bangalore. M7 is independent of everything except V1 being merged to main.

---

## 7. Open decisions for Sundaresh

Things genuinely undecided that need user input before code is written.

1. **Place model**: confirm `RegionConfig` as sibling to `CityConfig` (recommended) vs forcing into `CityConfig` with NULL ULB fields.
2. **Migration coordination with Bangalore**: is `reservoir_daily_v2` already designed in `bangalore_onboarding`? If so, what's its key shape? If not, who owns the design? Don't fork.
3. **Cauvery basin polygon source**: India-WRIS basin shapefile, GRDC, or our own dissolve of district boundaries? Affects every basin-rainfall number we publish.
4. **`project_multicity_refactor_decisions.md` location**: planning agent could not find it. Where is the canonical M0/M1/M2 capability-graph spec?
5. **Manual admin auth**: single ops user model already, or add a simple shared-secret cookie for the Biligundlu/IMD-forecast forms? `src/lib/cron-auth.ts` only covers cron, not interactive admin.
6. **Release threshold value**: brief says ~50 TMC. From the 2018 SC order, customary practice, or our own heuristic? Number ends up next to a percentage on the page. Same question for "June 12 customary date" (verify primary source).
7. **Stale-data tolerance per source**: CMWSSB precedent is 4 days. Mettur match? Biligundlu (manual) probably 7-14? KSNDMC?
8. **Tamil-language UI**: brief says deferred, but `src/lib/i18n/` exists and Chennai pages are bilingual. Ship `/cauvery` English-only and add Tamil in V1.1 (more work later)? Or scaffold the i18n keys with English copy in both `en` and `ta` locales now (less work later)? Recommend the latter.
9. **Branch base**: cut `kaveri_onboarding` from `bangalore_onboarding` (inherit refactor) or from main (avoid Bangalore drift)? Both have failure modes.
10. **`flow_station` enum addition timing**: enum lives in TS + Python + SQL CHECK at `017_cities_and_water_sources.sql:34`. Migration 018 needs to relax that CHECK or it'll reject the Biligundlu seed.
11. **Timeline visual placement**: above release banner (anchor structural story first) or below Mettur card (let live data lead)? Recommend below.
12. **Capex project list**: confirm the 5-6 post-1947 schemes worth showing. Research dossier has IAMWARM, ADB Vennar, AIIB Grand Anicut ERM, Mukkombu rebuild 2024, Cauvery sub-basin renovation. Anything else?
13. **Efficiency strip placement**: Mettur card definitely. Karnataka 4-dam (no, upstream of canal). Biligundlu (yes, since loss happens downstream of it)?
14. **V1.5 branch base**: cut `kaveri_infrastructure` from `kaveri_onboarding` post-V1-merge or from main? Recommend the latter - by V1.5 time, V1 should be in main.
15. **PSAZ + Madras HC encroachment scraping**: needs a court-compliance scraping pipeline that doesn't exist in the codebase yet. Ship V1.5 indicator 5 as a manual-curation page; automate later.
16. **Static infrastructure assets - lat/lon**: where do we source the points from? Wikipedia infoboxes are inconsistent; OSM has Kallanai, Mukkombu, Mettur as nodes. Verify before seeding.

---

## 8. Things explicitly NOT in V1

Restated as a contract.

- No block-level rainfall maps. No Sentinel-2 NDVI. No Sentinel-1 paddy-flood mapping (deferred to V1.5+).
- No Sentinel-1 head-vs-tail conveyance efficiency mapping (V1.5).
- No OSM canal segment x desilting join (V1.5).
- No Madras HC compliance scraping (V1.5, possibly never automated).
- No block-level ayacut shrinkage map (V1.5).
- No interactive infrastructure map (V1.5).
- The timeline visual in V1 is **static** - one fixed asset, not a live-data-driven component.
- No mandi prices. No cyclone tracker. No pest alerts.
- No Tamil-language UI in V1 (but see decision 8 above for whether to scaffold the i18n keys).
- No push alerts. No WhatsApp delivery. No FPO accounts. No farmer login.
- No salinity-creep dashboard.
- No connecting to the `news_articles` / Anthropic-narrative pipeline (`scripts/generate-narratives.ts`). Tempting because it's wired up and journalists love AI summaries, but generated narratives create error-attribution problems for a politically charged data product. Add later with a separate review workflow.
- No reuse of `src/components/insights/connected-insight.tsx` or news-context cards on the Cauvery page in V1. Tempting but they pull Chennai-specific data.
- No multi-place city-switcher in the global header. Cauvery is a separate landing route, not a tab in the Chennai dashboard.

---

## 9. Critical files for implementation

- `src/lib/cities/types.ts` - `WaterSourceType` enum, add `flow_station` and `rainfall_basin`
- `supabase/migrations/017_cities_and_water_sources.sql` - relax SQL CHECK for new enum values
- `src/lib/scrapers/cmwssb.ts` - pattern to mirror for `tn-pwd-mettur.ts`
- `src/app/api/cron/scrape-cmwssb/route.ts` - cron pattern with `pipeline_log`
- `.github/workflows/daily-data-pipeline.yml` - pattern for Python scrapers from Actions
- `neer-vazhvu-api/scripts/generate_imd_rainfall.py` - imdlib pattern to extend for basin rainfall
- `src/components/dashboard/storage-trend-chart.tsx` - reuse for KSNDMC cumulative-vs-normal
- `src/components/dashboard/reservoir-cards.tsx` - color logic to reuse for Mettur/Karnataka cards
- `src/components/dashboard/days-left-hero.tsx` - layout pattern to copy for June 12 banner
- `src/middleware.ts` and `next.config.ts` - frame-ancestors override for embed routes
- `src/app/api/og/` - existing OG image generator pattern to extend
- `src/lib/cron-auth.ts` - cron secret pattern (admin auth is separate, see decision 5)
