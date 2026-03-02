# Contributing to Neer Vazhvu

Thanks for your interest in contributing! This project tracks Chennai's water supply and aims to make civic data accessible to everyone.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- npm

### Frontend (Next.js)

```bash
npm install
npm run dev
```

The app runs in **demo mode** with realistic mock data when Supabase is not configured — no database setup needed to start contributing to the UI.

### Python API (FastAPI)

```bash
cd neer-vazhvu-api
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Full Setup (with live data)

If you need real data flowing through, you'll need a [Supabase](https://supabase.com) project:

1. Create a Supabase project
2. Run the migrations in `supabase/migrations/` against your database
3. Copy `.env.example` to `.env.local` (frontend) and `neer-vazhvu-api/.env.example` to `neer-vazhvu-api/.env`
4. Fill in your Supabase credentials
5. Seed historical data using the scripts in `scripts/`

## Project Structure

```
neer-vazhvu/
├── src/                  # Next.js frontend (App Router)
│   ├── app/              # Pages (dashboard, groundwater, about)
│   ├── components/       # React components
│   ├── lib/              # Utilities, mock data, Supabase client
│   └── types/            # TypeScript definitions
├── neer-vazhvu-api/      # Python API (FastAPI)
│   ├── app/scrapers/     # CMWSSB, NASA POWER, OpenCity
│   ├── app/etl/          # Pipeline orchestrator, constants
│   ├── app/intelligence/  # ARIMAX forecaster, risk scorer, briefing
│   └── app/routers/      # API endpoints
├── supabase/migrations/  # Database schema
└── .github/workflows/    # CI (daily pipeline, keepalive)
```

## Development Workflow

1. **Fork** the repository and clone your fork
2. **Create a branch** from `main`:
   - `feat/description` — new features
   - `fix/description` — bug fixes
   - `docs/description` — documentation
   - `chore/description` — tooling, deps, CI
3. **Make your changes** — keep PRs focused (one feature or fix per PR)
4. **Open an issue first** for significant changes so we can discuss the approach

## Code Style

### Frontend (TypeScript)

- ESLint: `npm run lint`
- TypeScript strict mode enabled
- Follow existing patterns — shadcn/ui components, Tailwind CSS

### Python API

- Lint: `ruff check .`
- Format: `ruff format .`
- Type hints encouraged on public functions

## Testing

- **Frontend**: Run `npm run build` to catch type errors and build issues
- **Python API**: `cd neer-vazhvu-api && pytest`
- Test coverage is thin — writing tests is a great way to contribute!

## Areas Where Help Is Needed

- **Data quality** — Improving scraper resilience, handling CMWSSB page format changes
- **Models** — Better forecasting (Prophet, LSTM), evaporation modeling
- **Frontend** — Risk map layer, briefing card component, mobile polish
- **Tamil localization** — Translating the UI for local accessibility
- **Testing** — Unit tests for scrapers, calculator, and intelligence modules

## Submitting a Pull Request

Before opening a PR, please check:

- [ ] Branch is based on latest `main`
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] PR description explains **what** changed and **why**
- [ ] For Python changes: `ruff check .` passes

We aim to review PRs within a few days. Thank you for contributing!
