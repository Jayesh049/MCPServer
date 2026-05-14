# Run the patient chat (frontend + backend)

Two terminals from the **repo root**.

## 1. Node API (includes REST + MCP HTTP)

```bash
# .env should include DATABASE_URL; for HTTP dev:
set MCP_TRANSPORT=http
set PORT=3333
npm run dev
```

Health check: `http://localhost:3333/api/health`  
Patient chat API: `POST http://localhost:3333/api/chat/patient` with JSON body  
`{ "message": "…", "language": "Hindi", "pdfBase64?": "…", "imageBase64?": "…", "includeRawRag?": false }`.

## 2. Next.js UI (port 3001)

```bash
cd frontend
set MCP_API_BASE_URL=http://localhost:3333
npm run dev
```

Open **http://localhost:3001/chat**.

The Next app rewrites `/api/*` to `MCP_API_BASE_URL` (see `frontend/next.config.js`). If the UI cannot reach the API, confirm `MCP_API_BASE_URL` matches the Node port.

**If you see `fetch failed` on the home page:** start the Node server first (`npm run dev` in repo root with `PORT=3333`). On Windows, prefer **`http://127.0.0.1:3333`** in `frontend/.env.local` as `MCP_API_BASE_URL` (not only `localhost`) so server-side fetches resolve reliably.

## Notes

- Answers are **plain English** templates + Wikipedia RAG; **no external LLM** on this path (`skipGeminiSynthesis` on the server).
- **Images** are not read visually; upload a **PDF with text** or describe an image in words.
