# MoneyMitra

AI-powered personal tax and finance assistant for Indian salaried users.

Status: **Phase 2 — real authentication.** The website is a clickable
prototype (mock data) with one real feature underneath: sign up, log in,
sessions, and protected routes. Tax calculation, document extraction,
recommendations, and finance management are still UI-only with mock data.

## Stack

- **Frontend (`apps/web`):** Next.js 16 (App Router) + TypeScript + Tailwind CSS + TanStack Query
- **Backend (`apps/backend`):** FastAPI (Python 3.12), modular monolith, versioned REST API under `/api/v1`
- **Database:** PostgreSQL, via SQLAlchemy + Alembic migrations

The backend is a standalone, versioned API. The frontend is purely an API
consumer — no business logic lives in frontend code — so a future mobile app
can reuse the same backend without duplicating logic.

## Project structure

```
apps/
  web/                  # Next.js frontend
    src/app/            # routes (App Router)
    src/components/     # reusable UI components (design system + shell)
    src/lib/            # API client, env config, mock data, auth
      lib/mock/         # centralized mock data (dashboard, documents, etc.)
      lib/auth/         # auth context, token store, API calls
    src/proxy.ts         # protects authenticated routes (redirect if no session)
  backend/
    app/
      core/config.py    # environment-driven settings
      db/               # SQLAlchemy engine/session/base
      modules/
        users/          # User model + schema
        auth/           # RefreshToken model, JWT/password security, auth service
      api/v1/           # versioned routes (thin — logic lives in modules/)
      main.py           # FastAPI app entrypoint
    alembic/            # migration environment + versions
    tests/              # pytest suite (own test database)
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.12+
- A running PostgreSQL server (locally installed, Postgres.app, or Docker)

## Run everything with Docker (easiest)

Docker runs the database, API, and website for you in containers — no need to
install Python, Node, or PostgreSQL. You only need
[Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and
running.

```bash
cp .env.example .env
# open .env and set JWT_SECRET (the file explains how to generate one)

docker compose up --build
```

The first build takes a few minutes; later starts are fast. When it settles:

- Website: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/v1/health

Database migrations are applied automatically when the API starts, and your
data lives in a Docker volume, so it survives restarts.

Everyday commands (run from the project root):

```bash
docker compose up -d          # start in the background
docker compose logs -f        # watch the logs (Ctrl+C to stop watching)
docker compose logs -f backend  # logs for just one service: db, backend, web
docker compose down           # stop everything (data is kept)
docker compose down -v        # stop AND delete the database data
docker compose up --build     # rebuild after you change code
```

Notes:

- **Port already in use?** Set `WEB_PORT`, `BACKEND_PORT` (or `DB_PORT`) in
  `.env` to free ports, then `docker compose up --build` again. The website
  and API addresses follow those values automatically.
- **Changing `BACKEND_PORT`** requires `--build`: the API address is baked
  into the website's code when it is built.
- **Code changes need a rebuild.** This setup runs the production build. For
  day-to-day development with hot reload, use the manual setup below (it can
  still use Docker for just the database).

## Backend setup

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt   # includes runtime deps + pytest/ruff

cp .env.example .env                  # then edit DATABASE_URL / CORS_ORIGINS if needed
```

Generate a real `JWT_SECRET` for `.env` (never commit a real one):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Configuring PostgreSQL

Option A — use an existing local Postgres server: create a database and role
matching `DATABASE_URL` in `.env` (defaults to `moneymitra`/`moneymitra`):

```bash
psql -d postgres -c "CREATE ROLE moneymitra LOGIN PASSWORD 'moneymitra';"
psql -d postgres -c "CREATE DATABASE moneymitra OWNER moneymitra;"
```

Option B — use the provided Docker Compose file (only if port 5432 is free
on your machine):

```bash
docker compose -f apps/backend/docker-compose.yml up -d
```

Also create a separate test database (used only by `pytest`, kept isolated
from your dev data):

```bash
psql -d postgres -c "CREATE DATABASE moneymitra_test OWNER moneymitra;"
```

### Running migrations

```bash
cd apps/backend
source .venv/bin/activate
alembic upgrade head
```

Migrations currently create `users`, `refresh_tokens` and `itr_filings`. Future phases add
models under their own `app/modules/<name>/models.py` (imported into
`app/db/all_models.py` so Alembic picks them up) and generate a migration
with `alembic revision --autogenerate -m "..."`.

### Running the backend

```bash
cd apps/backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

- Health check: `GET http://localhost:8000/api/v1/health` → `{"status": "ok", "database": "ok"}`
- Interactive API docs: `http://localhost:8000/docs`

> **Note:** if port 8000 (or 3000, below) is already used by another project
> on your machine, pass a different `--port` and update
> `apps/web/.env.local`'s `NEXT_PUBLIC_API_URL` and the backend's
> `CORS_ORIGINS` to match.

### Backend tests & lint

```bash
cd apps/backend
source .venv/bin/activate
pytest
ruff check app tests
```

## Frontend setup

```bash
cd apps/web
npm install
cp .env.example .env.local            # adjust NEXT_PUBLIC_API_URL if the backend runs on a different port
npm run dev -- --port 3000
```

Open `http://localhost:3000` — the MoneyMitra landing page. Sign up for an
account, then click through Dashboard / Documents / Tax Comparison /
Recommendations / Finance / Profile (all mock data except your identity,
which is real). Protected pages redirect to `/login` if you're not
signed in.

### Frontend checks

```bash
cd apps/web
npx tsc --noEmit     # type-check
npm run lint         # eslint
npm run build        # production build
```

## ITR Filing (ITR-1, AY 2026-27)

The **ITR Filing** page (`/itr-filing`) prepares an ITR-1 (Sahaj) return and
exports it as the official e-filing JSON. MoneyMitra does **not** submit the
return: the user uploads the file at incometax.gov.in (e-File → Income Tax
Returns → File Income Tax Return → AY 2026-27 → offline / upload JSON) and
e-verifies it. Direct submission requires ERI registration with the Income
Tax Department.

- Backend module: `apps/backend/app/modules/itr/` — per-year rules
  (`rules.py`), computation (`computation.py`, reusing the tax module's
  slabs/rebate), interest 234A/B/C and fee 234F (`interest.py`), eligibility
  and field checks (`validation.py`), JSON export (`export.py`).
- The export is validated against the official schema in
  `app/modules/itr/official/` (ITR-1 schema v1.1 from incometax.gov.in).
- Rules follow the CBDT "ITR 1 – Validation Rules for AY 2026-27". Notably,
  after the due date (31 Jul 2026) only the new regime is allowed (belated
  return u/s 139(4), filed until 31 Dec 2026).
- Tax law updates: add a new `ItrYearRules` entry and schema file per
  assessment year (and a new `TaxYearRules` for slab changes). There is no
  official live tax-rules API, so rules are versioned in code.
- Before real users upload: set `ITR_SOFTWARE_ID` in `.env` to the software
  ID issued by the department (the default `SW00000000` is a placeholder),
  and encrypt `itr_filings.data` at rest (it holds PAN, Aadhaar, bank details).
- Not supported in ITR-1 here: capital gains (incl. LTCG u/s 112A), 80E/80G/
  80GG/80DD/80U and other less common deductions, relief u/s 89, co-owned
  properties. Users with these should use the official utility.

## What's intentionally not here yet

Tax regime comparison, document extraction/OCR, LLM integration,
recommendations, and finance management all still run on mock data in the
frontend (see `apps/web/src/lib/mock/`) — no backend logic exists for them
yet, and none of it is called via fake API endpoints. Only authentication
(sign up, log in, sessions, protected routes) is real end-to-end.
