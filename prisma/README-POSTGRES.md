# PostgreSQL migrations

SQL migrations live in [`prisma/migrations/`](migrations/).

- **Fresh cloud DB:** set `DATABASE_URL` in `.env`, then:

  ```bash
  npx prisma migrate deploy
  npm run db:seed
  npm run db:enrich
  ```

  Or one shot: `npm run setup:all`.

- **Local SQLite (optional):** use a separate checkout or temporarily set `provider = "sqlite"` in `schema.prisma` and `file:./prisma/rag.sqlite` — not officially dual-supported in one schema file.
