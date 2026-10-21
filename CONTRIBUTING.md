# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks Indian cities' water systems (Chennai, Madurai, Bengaluru, Mumbai, Delhi and other cities live, more on the way) and aims to make civic data accessible to everyone.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

Setup, the project structure and the new-city walkthrough live in [`contributing-docs/`](contributing-docs/):

1. [Contributor's quick start](contributing-docs/01_contributors_quick_start.md)
2. [Project structure](contributing-docs/02_project_structure.md)
3. [Adding a new city](contributing-docs/03_adding_a_city.md)

### Adding or changing a data file

Any `.json` or `.geojson` file under `public/data/` or `public/geojson/` follows NVDM (the Neer
Vazhvu Data Model). In short: the file carries an envelope naming its dataset, its place and its
sources; scripts rewrite it through the writers so the envelope survives; and a CI gate requires a
new file to reach level L2 and an existing conforming file to keep its level.

- What is required: [`schemas/nvdm/RULES.md`](schemas/nvdm/RULES.md).
- How to do it, step by step: [`schemas/nvdm/GUIDE.md`](schemas/nvdm/GUIDE.md).
- Before you push: `bash scripts/nvdm-gate.sh origin/main`
  ([the full list](schemas/nvdm/GUIDE.md#8-before-you-open-a-pull-request)).

## Earth Engine Phase 1

If you are working on the satellite summary layer, also read [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md) and the shipped-method write-ups under [docs/methodology/](docs/methodology/).

Local prerequisites for GEE work:

- an Earth Engine-enabled Google Cloud project
- a service account with `Earth Engine Resource Writer` and `Service Usage Consumer`
- `GEE_CLOUD_PROJECT` plus either `GEE_SERVICE_ACCOUNT_FILE` or `GEE_SERVICE_ACCOUNT_JSON`

Useful commands from `neer-vazhvu-api/`:

```bash
python scripts/run_gee_phase1.py check-auth
python scripts/run_gee_phase1.py build-targets --write
python scripts/run_gee_phase1.py validate-catchments
python scripts/run_gee_phase1.py run-reservoir-context --write
python scripts/run_gee_phase1.py run-water-body-summaries --write
```

Current workflow note:

- `.github/workflows/gee-phase1.yml` is wired for manual dispatch in this branch
- if you change the GEE data model or methodology, update both [README.md](README.md) and [GEE_PHASE2_3_PLAN.md](GEE_PHASE2_3_PLAN.md) and the shipped-method write-ups under [docs/methodology/](docs/methodology/) in the same PR

## Development Workflow

1. **Fork** the repository and clone your fork
2. **Create a branch** from `main`:
   - `feat/description` — new features
   - `fix/description` — bug fixes
   - `docs/description` — documentation
   - `chore/description` — tooling, deps, CI
3. **Make your changes** — keep PRs focused (one feature or fix per PR)
4. **Open an issue first** for significant changes so we can discuss the approach

## Testing

- **Frontend**: `npm run test` (runs `tsx --test` for utility tests) and `npm run build` (catches type errors)
- **Python API**: `cd neer-vazhvu-api && pytest`
- **i18n validation**: `npm run i18n:check` (verifies TA + KN translations exist for all keys)
- Test coverage is thin, and writing tests is a great way to contribute. See [docs/backlog.md](docs/backlog.md) for open test work.

## Areas Where Help Is Needed

### Chennai
- **Data quality** - Improving CMWSSB scraper resilience, handling page-format changes
- **Models** - Better forecasting (Prophet, LSTM), evaporation modelling
- **Frontend** - Daily briefing card integration, chart clarity, mobile polish

### Madurai
- **RTI follow-ups for layers MMC tracks internally but doesn't publish** - daily Pannaipatty WTP raw-water intake + treated output, OHT-wise live storage (23 OHTs), per-zone supply (81 zones), non-revenue water, LPCD actuals. See the "What's missing today" subsection at `/madurai/about` for the institutional landscape.
- **Parsing the ADB TNUFIP IEEs** (`docs/research/adb-tnufip/49107-005-iee-en_10.pdf` and `49107-010-iee-en_0.pdf`) for zone-level demand projections and OHT capacity tables. Powers the deferred "structural at-a-glance heatmap" tile.
- **Lost-tank coordinate research** - the 26 Vencatesan/DHAN documented lost tanks have name + status but no lat/lng. Geocoding historical tank names is research-heavy and most have no OSM presence (they're lost).
- **PWD-WRD Vaigai release log** - currently scraped from episodic news coverage; a structured RTI to PWD-WRD Vaigai Basin Circle would unlock daily releases-by-purpose.

### Bengaluru
- **BWSSB Stage V actual-vs-design RTI** - The Ken (Feb 2026) reported Stage V is delivering ~400 MLD against 775 MLD design. A structured RTI to BWSSB for weekly lift logs would unlock the daily Cauvery-pumping series, not just episodic reporting.
- **Lost-tank coordinate research** - similar to Madurai. The Bangalore lost-tank inventory (~100 documented bodies via T.V. Ramachandra et al.) has name + status but sparse lat/lng. Most have no OSM presence (they're built over).
- **KSPCB OCMMS scraping** - the Karnataka State Pollution Control Board publishes effluent monitoring for red-category industries. We don't yet pull it into the industrial-sources overlay.
- **Long-form Kannada story review** - `src/content/story-bangalore-kn.tsx` is a 4-chapter / ~4,000-word translation pending native-speaker review.
- **More rich-body candidates** - 13 onboarded today. Other candidates: Begur, Allalasandra, Doddabommasandra, Yele Mallappa Shetty. Pattern is registry-driven; see [src/lib/water-bodies/rich-body-registry.ts](src/lib/water-bodies/rich-body-registry.ts).

### Cross-city / shared
- **Tamil prose review** - especially `src/app/[cityId]/about/madurai-page-descriptions.tsx` and the Madurai story pages. Native-speaker review wanted.
- **Kannada prose review** - `src/content/about/bangalore-pages.tsx`, the BangaloreDailyBriefing variants in `src/content/briefing/bangalore.ts`, and the long-form story (`src/content/story-bangalore-kn.tsx`). Native-speaker review wanted.
- **Localization (UI)** - ~1,500 i18n keys covering EN + TA + KN; `npm run i18n:check` enforces parity.
- **Testing** - Unit tests for scrapers, calculator, intelligence modules, and the shared `src/lib/utils/river-classification.ts` (CPCB Best-Use classifier).
- **Adding a new city** - see [Adding a new city](contributing-docs/03_adding_a_city.md).

## Submitting a Pull Request

Before opening a PR, please check:

- [ ] Branch is based on latest `main`
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] `npm run i18n:check` passes (if UI text changed)
- [ ] For Python changes: `ruff check .` and `pytest` pass
- [ ] For data changes: the NVDM generators are re-run and `bash scripts/nvdm-gate.sh origin/main` passes ([steps](schemas/nvdm/GUIDE.md#8-before-you-open-a-pull-request))
- [ ] PR description explains **what** changed and **why**

We aim to review PRs within a few days. Thank you for contributing!
