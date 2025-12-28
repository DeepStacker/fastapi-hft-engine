@echo off
REM ═══════════════════════════════════════════════════════════════════
REM Stockify Trading Platform - Development Run Script (Windows)
REM ═══════════════════════════════════════════════════════════════════

echo Starting Stockify Trading Platform...

REM Check if .env exists
if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
)

REM Activate virtual environment if exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Run the application
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
