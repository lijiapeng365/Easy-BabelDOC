@echo off
echo Starting BabelDOC Web Application...
echo.

echo Starting Python Backend...
start "Backend" cmd /k "cd /d %~dp0 && backend\venv\Scripts\activate && python backend/main.py"

echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo Starting React Frontend...
start "Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Both services are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul