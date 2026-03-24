# 🌾 HarvestForge Logistics Planner v3.0

Command center for custom harvesting fleet operations. Manages 97+ combines, support equipment, and crews across multi-state seasonal campaigns.

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your JD, Mapbox, and weather API keys

# 2. Start all services
docker compose up -d

# 3. Run database migrations
npm run db:migrate

# 4. Seed development data (97 combines, 65 crew, 70 fields)
npm run db:seed

# 5. Open the app
open http://localhost:5173
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Web | 5173 | React frontend (Command Center) |
| API | 3001 | Fastify REST API + WebSockets |
| Solver | 8001 | Python optimization engine (OR-Tools) |
| PostgreSQL | 5432 | Database with PostGIS |
| Redis | 6379 | Caching + real-time pub/sub |

## Project Structure

```
harvestforge/
├── docker-compose.yml
├── packages/
│   ├── api/              # Fastify backend
│   │   ├── src/
│   │   │   ├── routes/   # Endpoint handlers
│   │   │   ├── services/ # Business logic
│   │   │   ├── models/   # DB + Redis clients
│   │   │   ├── jobs/     # Cron jobs (sync, briefing)
│   │   │   └── seeds/    # Dev data generators
│   │   └── migrations/   # SQL migrations
│   ├── web/              # React frontend
│   │   └── src/
│   │       ├── pages/    # Route pages
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── services/ # API client
│   │       └── store/    # Zustand state
│   ├── solver/           # Python optimizer
│   │   └── harvestforge_solver/
│   ├── shared/           # Types, constants, validation
│   └── mobile/           # React Native (Phase 2)
└── docker/               # Dockerfiles
```

## Development

```bash
# Run API + Web without Docker
npm run dev

# Run solver standalone
npm run dev:solver

# Run tests
npm test

# Create a new migration
npm run db:migrate:create -- my-migration-name
```

## Key Docs

- [PRD v3.0](./docs/HarvestForge_PRD_v3.docx)
- [API Contract](./docs/harvestforge_api_contract.md)
- [Database Schema](./docs/harvestforge_schema.sql)

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind, Mapbox GL, Zustand
- **API:** Fastify 5, PostgreSQL 16 + PostGIS, Redis 7, Zod
- **Solver:** Python, FastAPI, OR-Tools
- **Mobile:** React Native (Phase 2)
