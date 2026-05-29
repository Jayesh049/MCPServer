# Startup guide — MCPServer

How to run the **backend (Node)** and **frontend (Next.js)** on your machine. For full API docs, MCP, Docker, and optional Python services, see [README.md](README.md).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** ≥ 18.18 | Node 20 LTS is fine (`nvm use 20`). |
| **PostgreSQL** | Connection string in root `.env` as `DATABASE_URL`. See [prisma/README-POSTGRES.md](prisma/README-POSTGRES.md). |
| **npm** | Comes with Node. |

Optional later: Python 3.12+ for [ml/flask_disease/](ml/flask_disease/README.md), Gemini/OpenAI keys for faster embeddings.

---

## 1. One-time setup (repo root)

```powershell
cd "C:\path\to\MCPServer"
npm install
```

### Environment file

1. Copy the example and edit with your real Postgres URL:

   ```powershell
   copy .env.example .env
   ```

2. In **`.env`** (repo root), set at minimum:

   ```env
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
   ```

   Do **not** commit `.env` to git.

### Database migrations

```powershell
npm run db:migrate:deploy
```

If that fails on a fresh dev DB, try once:

```powershell
npm run db:migrate
```

Optional: seed demo data / RAG bank:

```powershell
npm run db:seed
npm run db:train-bank
```

Optional: train **Ayurveda Yoga/Pranayama** corpus (used by `/api/ayurveda/yoga` and MCP tool `suggest_ayurveda_yoga`):

```powershell
npm run db:train-ayurveda
```

### Build backend (optional for `npm run dev`)

`npm run dev` uses `tsx` and does not require a build. For production-style `node dist/index.js`:

```powershell
npm run build
```

---

## 2. Start the backend (Terminal 1)

From **repo root**:

```powershell
set MCP_TRANSPORT=http
set PORT=3333
npm run dev
```

You should see:

`MCP Streamable HTTP + REST API listening on http://0.0.0.0:3333 (mcp at /mcp, api at /api/*)`

**Verify:**

- http://127.0.0.1:3333/api/health → JSON with `"ok": true`
- http://127.0.0.1:3333/api/ayurveda/yoga?disease=diabetes → Ayurveda yoga/pranayama JSON (requires `npm run db:train-ayurveda`)

**Database errors on login** (`Can't reach database server at db.prisma.io`):

1. Set **`DATABASE_URL`** in root **`.env`** to your **Neon** connection string (from [console.neon.tech](https://console.neon.tech)), not `db.prisma.io`, unless you actively use Prisma Postgres.
2. Run `npm run db:migrate:deploy` once after changing the URL.
3. **Restart** the backend (`npm run dev` in repo root) so it reloads `.env`.

**PowerShell (persistent for session):**

```powershell
$env:MCP_TRANSPORT = "http"
$env:PORT = "3333"
npm run dev
```

---

## 3. Start the frontend (Terminal 2)

```powershell
cd frontend
npm install
```

Create **`frontend/.env.local`** (or copy from `frontend/.env.example`):

```env
MCP_API_BASE_URL=http://127.0.0.1:3333
```

Must match the backend **`PORT`** (3333). On Windows, **`127.0.0.1`** is more reliable than `localhost` for proxies.

**Development (recommended):**

```powershell
npm run dev
```

Open:

| URL | Page |
|-----|------|
| http://localhost:3001 | Disease list (home) |
| http://localhost:3001/chat | Simple patient chat |
| http://localhost:3001/report | PDF report demo |
| http://localhost:3001/diseases/&lt;slug&gt; | Per-disease tester |

**Production mode** (needs a build first):

```powershell
npm run build
npm start
```

Use **`npm run dev`** while developing to avoid OneDrive/`.next` lock issues.

---

## 4. Architecture (two processes)

```mermaid
flowchart LR
  Browser[Browser_3001]
  Next[Next.js_frontend]
  Node[Node_API_3333]
  DB[(Postgres)]
  Browser --> Next
  Next -->|rewrite_/api/*| Node
  Node --> DB
```

- **UI code:** `frontend/app/`, `frontend/components/`
- **API code:** `src/api/`, `src/mcp/`, `src/rag/`

---

## 5. Quick checks

| Check | Command / URL |
|-------|----------------|
| API alive | http://127.0.0.1:3333/api/health |
| List diseases | http://127.0.0.1:3333/api/diseases |
| Patient chat (API) | `POST` http://127.0.0.1:3333/api/chat/patient with body `{"message":"What is high blood pressure?"}` |
| UI proxy env | `frontend/.env.local` → `MCP_API_BASE_URL` same port as Node |

---

## 5b. Patient chat — LLM (simple answers, optional)

The chat at `/chat` calls **`POST /api/chat/patient`** ([`src/api/patientChat.ts`](src/api/patientChat.ts)):

1. **RAG** runs first (Wikipedia + your question / PDF text).
2. Then an **LLM** rewrites the retrieved context into short, simple language (and can follow the **language** dropdown) **if** a provider key is set.

**Provider priority (first key wins):** Gemini → Groq → OpenAI → Anthropic → OpenRouter → **template fallback** (no key).

**Recommended:** add **`GEMINI_API_KEY`** (or **`GOOGLE_API_KEY`**) to **root `.env`** — same key you can use for embeddings; free tier on [Google AI Studio](https://aistudio.google.com/apikey).

Optional env vars are documented in [`.env.example`](.env.example) (search `Patient chat`).

- **`PATIENT_CHAT_DISABLE_LLM=1`** — skip the LLM and use the short template only.
- **`history`** — optional JSON array of `{ "role": "user"|"assistant", "content": "..." }` for multi-turn (API only).

Restart **`npm run dev`** in the repo root after editing `.env`.

**If the UI still says `LLM: none`:** keys must live in **repo root** `.env` (not `frontend/.env`). The Node server loads that file on startup (via `dotenv` in `src/index.ts`).

**Security:** Never paste real API keys into chat or screenshots. **Rotate** the Gemini and Groq keys you posted here and put the new values only in **root `.env`** on your machine.

---

## 5c. DigiLocker + consultation social workflow

New `/api/platform/*` flow:

- Patient post creation remains allowed, but visibility is doctor-oriented.
- Doctors can view and reply; patient can initiate consultation after doctor response.
- Consultation now supports:
  - listing and detail fetch
  - dual-consent recording ingestion metadata
  - bilateral 10-point ratings with 10-form answers + signature
  - automated validation run + manual review queue

New key endpoints:

- `GET /api/platform/doctors/digilocker/start`
- `GET /api/platform/doctors/digilocker/callback`
- `GET /api/platform/doctors/verification-status`
- `GET /api/platform/consultations`
- `GET /api/platform/consultations/:id`
- `POST /api/platform/consultations/:id/consent-recording`
- `POST /api/platform/consultations/:id/recording`
- `POST /api/platform/ratings/doctor`
- `POST /api/platform/ratings/patient`
- `GET /api/platform/ratings/review-queue`
- `POST /api/platform/ratings/review/:id`

Set DigiLocker env in root `.env` based on `.env.example`:
`DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`, `DIGILOCKER_REDIRECT_URI`, and optional DigiLocker endpoint overrides.

---

## 6. Common problems

### `fetch failed` or empty disease list on home page

- Start **backend first** (Terminal 1 on port **3333**).
- Set `MCP_API_BASE_URL=http://127.0.0.1:3333` in `frontend/.env.local`.
- Restart `npm run dev` in `frontend` after changing env.

### Proxy still goes to wrong port (e.g. 3335)

1. Open `frontend/.env.local` and fix `MCP_API_BASE_URL`.
2. In PowerShell: `echo $env:MCP_API_BASE_URL` — remove or fix if it shows the wrong port (Windows user env overrides `.env.local`).
3. Delete `frontend/.next`, run `npm run build` again if using `npm start`.

### `ECONNREFUSED` on `/api/chat/patient`

Backend is not running or port mismatch. Backend on **3333**, frontend env must point to **3333**.

### `EPERM` on `npm run build` or `prisma generate` (OneDrive)

- Stop all `npm run dev` / `npm start` processes.
- Delete `frontend/.next` or retry after pausing OneDrive sync.
- Prefer working from a folder **outside** OneDrive (e.g. `C:\dev\MCPServer`).

### `next build` / `npm start` — “no production build”

Run `npm run build` in `frontend` before `npm start`, or use `npm run dev` instead.

### `next` is not recognized

Use `npm run build`, not bare `next build`.

---

## 7. Optional services

| Service | When | Doc |
|---------|------|-----|
| Python RAG agent | `AGENT_RAG_URL` set on Node | [agent/README.md](agent/README.md) |
| Flask disease ML | `DISEASE_ML_URL` set on Node | [ml/flask_disease/README.md](ml/flask_disease/README.md) |
| MCP-only gateway | `npm run start:mcp-http` | [README.md](README.md) |

---

## 8. Related docs

- [README.md](README.md) — full feature list, MCP, ngrok, Docker
- [frontend/DEV-CHAT.md](frontend/DEV-CHAT.md) — patient chat details
- [.env.example](.env.example) — all env vars (commented)

---

## Disclaimer

Educational / synthetic demo only. Not for clinical decisions or real patient data (PHI).
