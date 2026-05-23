# Host karo — tum sirf browser steps (5–20 min)

Maine repo mein deploy files add kar di hain. **Login Render + Vercel + Neon tumhein khud karna hoga** (password mere paas nahi).

---

## ✅ Maine jo kar diya (code side)

| File | Kaam |
|------|------|
| `frontend/vercel.json` | Vercel par frontend auto-detect |
| `render-starter.yaml` | Render par sirf backend (Docker) |
| `deploy/render-env.template.txt` | Render env copy-paste list |
| `deploy/vercel-env.template.txt` | Vercel env |
| `scripts/host-prep.ps1` | Local build check |
| `.github/workflows/ci.yml` | GitHub par frontend+backend build |

**Frontend production build:** ✅ pass (local)

**Backend build:** agar `npm run dev` chal raha ho to pehle **Ctrl+C** band karo, phir `npm run build` (OneDrive EPERM fix).

---

## Step 1 — Neon (database)

1. https://neon.tech → project banao  
2. **Connection string** copy → notepad mein rakho  

---

## Step 2 — GitHub push

PowerShell (repo root):

```powershell
git add deploy frontend/vercel.json render-starter.yaml scripts/host-prep.ps1 .github/workflows/ci.yml
git add src frontend   # baaki changes jo deploy chahiye
git commit -m "chore: deploy configs for Render + Vercel"
git push origin master:main
```

(Agar branch `main` hai to `git push origin main`)

GitHub → **Actions** tab → CI **green** hona chahiye.

---

## Step 3 — Render (backend API)

1. https://dashboard.render.com → **New +** → **Blueprint**  
   - Repo: `Jayesh049/MCPServer`  
   - Blueprint file: `render-starter.yaml`  
   **YA** **Web Service** → Docker → `Dockerfile`  

2. **Environment** — `deploy/render-env.template.txt` kholo, values bharo:
   - `DATABASE_URL` = Neon string  
   - `GROQ_API_KEY`, `GEMINI_API_KEY`, optional `HF_API_TOKEN`  

3. Deploy wait → URL milega:
   ```text
   https://mcp-server-xxxx.onrender.com
   ```

4. Test: browser mein  
   `https://mcp-server-xxxx.onrender.com/api/health`

---

## Step 4 — Vercel (UI / chat)

1. https://vercel.com → **Add New Project** → GitHub `MCPServer`  
2. **Root Directory:** `frontend`  
3. **Environment Variables** (dono same Render URL, **bina trailing slash**):
   ```text
   MCP_API_BASE_URL=https://mcp-server-api-7go2.onrender.com
   NEXT_PUBLIC_MCP_API_BASE_URL=https://mcp-server-api-7go2.onrender.com
   ```
   `NEXT_PUBLIC_*` browser ko seedha Render bulata hai (chat timeout fix).

4. **Redeploy** zaroori hai env change ke baad.

5. Deploy → URL:
   ```text
   https://something.vercel.app
   ```

6. Open → **Patient Chat** / **History** test karo (pehli chat 30–60s — Render cold start).

---

## Step 5 — Verify

| Check | URL |
|-------|-----|
| API health | `https://...onrender.com/api/health` |
| UI home | `https://....vercel.app` |
| Chat | `/chat` |
| Delete history | `/history` → Delete button |

---

## Agar backend build fail (EPERM)

- `npm run dev` band karo  
- Repo ko `C:\dev\MCPServer` par copy karo (OneDrive se bahar)  
- `npm run build` dubara  

---

## Turant demo (bina cloud)

```powershell
npm run dev
# doosra terminal
cd frontend; npm run dev
# optional public URL
ngrok http 3333
```

---

Repo: https://github.com/Jayesh049/MCPServer
