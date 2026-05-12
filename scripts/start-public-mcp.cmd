@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo === MCP on port 3333 ===
netstat -ano | findstr ":3333" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting MCP in a new window...
  start "MCP HTTP" cmd /k "cd /d ""%~dp0.."" && set PORT=3333 && npm start"
  timeout /t 5 /nobreak >nul
) else (
  echo Port 3333 is in use ^(server likely running^).
)

echo.
echo === ngrok ===
curl.exe -s http://127.0.0.1:4040/api/tunnels 2>nul | findstr "public_url" >nul
if errorlevel 1 (
  echo Starting ngrok in a new window ^(npx^)...
  start "ngrok" cmd /k "cd /d ""%~dp0.."" && npx --yes ngrok http 3333"
  echo When it is up: open http://127.0.0.1:4040  or run:  curl.exe -s http://127.0.0.1:4040/api/tunnels
  goto :eof
)

echo Tunnel JSON ^(use https ... host ... /mcp for Prompt Opinion^):
curl.exe -s http://127.0.0.1:4040/api/tunnels
echo.
echo Inspector: http://127.0.0.1:4040
endlocal
