## Getting Started

### Prerequisites

- Node.js 18+
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
cd neer-vazhvu
# setup a python virtual environment
python3 -m venv venv
source venv/bin/activate
cd neer-vazhvu-api
# install dependencies
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```


### Supabase

#### TODO

