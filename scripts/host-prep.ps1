# Run from repo root before cloud deploy. Does not upload secrets.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "=== MCPServer host prep ===" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Write-Warning ".env missing — copy .env.example to .env and set DATABASE_URL first."
} else {
  Write-Host "OK: .env exists"
}

Write-Host "`n[1/3] Backend build..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }

Write-Host "`n[2/3] Frontend build..." -ForegroundColor Yellow
Push-Location frontend
if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local" -ErrorAction SilentlyContinue
  Write-Host "Created frontend/.env.local from .env.example"
}
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
Pop-Location

Write-Host "`n[3/3] Smoke (local backend must be running on 3333)..." -ForegroundColor Yellow
$env:BASE_URL = "http://127.0.0.1:3333"
npm run smoke:health

Write-Host "`n=== Prep done ===" -ForegroundColor Green
Write-Host "Next: push to GitHub, then Render (Dockerfile) + Vercel (frontend/)."
Write-Host "Env templates: deploy/render-env.template.txt , deploy/vercel-env.template.txt"
