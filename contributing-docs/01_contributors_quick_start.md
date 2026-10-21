## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ (3.12 recommended; used in CI)
- npm

Create a fork of the repository and clone it:

```sh
git clone https://github.com/<you>/neer-vazhvu.git
```

### Frontend (Next.js)

```bash
cd neer-vazhvu
npm install
npm run dev
```

Without Supabase configured, pages render from the static files in `public/data` and the database-backed panels show as unavailable, so most UI work needs no database setup.

### Python API (FastAPI)

```bash
cd neer-vazhvu/neer-vazhvu-api
# setup a python virtual environment
uv venv
# install dependencies
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Full Setup (with live data)

If you need real data flowing through, you'll need a [Supabase](https://supabase.com) project:

1. Create a Supabase project
2. Run the migrations in `supabase/migrations/` against your database
3. Copy `.env.example` to `.env.local` (frontend) and `neer-vazhvu-api/.env.example` to `neer-vazhvu-api/.env`
4. Fill in your Supabase credentials
5. Seed historical data using the scripts in `scripts/`

## Code Style

### Frontend (TypeScript)

- ESLint: `npm run lint`
- TypeScript strict mode enabled
- Follow existing patterns — shadcn/ui components, Tailwind CSS

### Python API

- Lint: `ruff check .`
- Format: `ruff format .`
- Type hints encouraged on public functions
