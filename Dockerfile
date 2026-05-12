# MCP + HTTP API (Node 22). DATABASE_URL required at runtime for Prisma.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN npx prisma generate && npx tsc -p tsconfig.json

ENV NODE_ENV=production
ENV PORT=3333
ENV MCP_TRANSPORT=http

EXPOSE 3333

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
