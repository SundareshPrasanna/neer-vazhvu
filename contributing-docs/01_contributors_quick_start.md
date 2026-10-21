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

### Python API (FastAPI)

```bash
cd neer-vazhvu/neer-vazhvu-api
# setup a python virtual environment
uv venv
# install dependencies
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```


### Supabase

#### TODO

