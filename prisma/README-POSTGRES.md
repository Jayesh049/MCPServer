# PostgreSQL migrations

SQL migrations live in [`prisma/migrations/`](migrations/).

## Neon (free tier) for production

1. Create a project at [Neon](https://neon.tech) and copy the **connection string** (usually `postgresql://…` with `sslmode=require`).
2. In Render (or any host), set **`DATABASE_URL`** to that exact string so the container can run `prisma migrate deploy` on startup.
3. After deploy, check **`https://<your-service>.onrender.com/api/health`** and point Prompt Opinion at **`https://<your-service>.onrender.com/mcp`**.
4. Optional smoke check from the repo root (Node 18+):  
   `BASE_URL=https://<your-service>.onrender.com npm run smoke:health`

- **Fresh cloud DB:** set `DATABASE_URL` in `.env`, then:

  ```bash
  npx prisma migrate deploy
  npm run db:seed
  ```

  Or one shot: `npm run setup:all`.

- **Local SQLite (optional):** use a separate checkout or temporarily set `provider = "sqlite"` in `schema.prisma` and `file:./prisma/rag.sqlite` — not officially dual-supported in one schema file.

- **Disease Wikipedia ETL (optional):** models `DiseaseWebInfo`, `DiseaseSpecialistInfo`, `DiseaseYogaPranayamInfo`, `DiseaseCriticalityProfile` store fetched/educational content keyed by the same **`slug`** values as [`src/diseases/registry.ts`](../src/diseases/registry.ts). Populate with [`../ml/README.md`](../ml/README.md) after migrations are applied.

- **Prisma CLI version:** This repo pins **Prisma 6.18.x** (`schema.prisma` uses `url = env("DATABASE_URL")`). If bare `npx prisma` on your machine resolves to **Prisma 7**, it will error on `url`. Prefer **`npm run db:migrate:deploy`** (uses the local `prisma` binary) or **`.\node_modules\.bin\prisma migrate deploy`** after `npm ci`.
