# PostgreSQL (optional production)

Default in this repo is **SQLite** (`DATABASE_URL=file:./prisma/rag.sqlite`) so you can run migrate/seed/enrich **without Docker**.

To use Postgres again:

1. Copy `postgresql-archive-migrations` back to `migrations`, or recreate from SQL.
2. Point `DATABASE_URL` at your Postgres instance.
3. In `schema.prisma`, set `provider = "postgresql"` and run `prisma migrate deploy`.

The archived migrations live in `postgresql-archive-migrations/`.
