# MoneyMitra

AI-powered personal tax and finance assistant for Indian salaried users.

Status: architecture/planning phase — implementation has not started yet.

## Planned stack

- **Frontend (web):** Next.js + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python), modular monolith
- **Database:** PostgreSQL + SQLAlchemy/Alembic
- **Design system:** see project style guide (Poppins, navy/blue/lime palette)

The backend is built as a standalone API so a future mobile app can reuse
authentication, document, tax, and recommendation logic without duplication.
