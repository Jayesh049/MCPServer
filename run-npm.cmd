@echo off
rem Workaround when C:\Windows\System32\npm shadows real npm (0-byte bogus file).
rem Usage: run-npm.cmd start   OR   run-npm.cmd run build
set "NPMC=%ProgramFiles%\nodejs\npm.cmd"
if not exist "%NPMC%" (
  echo ERROR: npm.cmd not found at "%NPMC%". Install Node.js from https://nodejs.org/
  exit /b 1
)
"%NPMC%" %*
