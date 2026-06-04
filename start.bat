@echo off
title RMS
color 0A

echo ============================================
echo    Restaurant Management System
echo ============================================
echo.

set "PYTHON_CMD=python"
set "BACKEND_PYTHON=%~dp0backend\.venv\Scripts\python.exe"

:: Verify Python is available
%PYTHON_CMD% --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not available in PATH.
    pause
    exit /b 1
)

:: ── Backend setup ──
echo [1/4] Installing backend dependencies...
cd /d "%~dp0backend"
%PYTHON_CMD% -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo ERROR: Backend dependency install failed.
    pause
    exit /b 1
)
echo       Done.

:: ── Frontend setup ──
echo [2/4] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install --silent
if %errorlevel% neq 0 (
    echo ERROR: Frontend dependency install failed.
    pause
    exit /b 1
)
echo       Done.

echo.
echo [3/4] Starting backend (FastAPI)...
cd /d "%~dp0backend"
if exist "%BACKEND_PYTHON%" (
    set "UVICORN_PYTHON=%BACKEND_PYTHON%"
) else (
    set "UVICORN_PYTHON=%PYTHON_CMD%"
)
start "RMS Backend" cmd /k ""%UVICORN_PYTHON%" -m uvicorn app.main:app --reload --reload-dir app --reload-exclude scripts --host 0.0.0.0 --port 10000"

:: Give backend a moment to boot
timeout /t 3 /nobreak >nul

echo [4/4] Starting frontend (Vite)...
cd /d "%~dp0frontend"
start "RMS Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo    Both servers are running!
echo    Frontend : http://localhost:5173
echo    Backend  : http://localhost:10000
echo    API Docs : http://localhost:10000/docs
echo ============================================
echo.
echo Close this window or press any key to exit.
pause >nul
