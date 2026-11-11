@echo off
setlocal EnableExtensions
title Class Attendance Management System - Group G
cd /d "%~dp0"

echo ==========================================================
echo   Class Attendance Management System - Group G (SWE2106)
echo ==========================================================
echo.

REM ---------- 0. Local configuration file ----------
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo [i] Created .env from .env.example.
  )
)

REM ---------- 1. Node dependencies (first run only) ----------
if not exist "node_modules" (
  echo [i] Installing Node dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo [!] npm install failed. Install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
  )
)

REM ---------- 2. Project database on port 3307 ----------
call :port_open 3307
if errorlevel 1 (
  echo [i] Starting the database ^(MySQL on port 3307^)...
  start "Class Attendance - MySQL (keep this window open)" cmd /k ""%~dp0database\start-database.cmd""
  echo [i] Waiting for MySQL to accept connections...
  call :wait_port 3307 40
  if errorlevel 1 (
    echo [!] The database did not start. Check the MySQL window for errors.
    pause
    exit /b 1
  )
) else (
  echo [ok] Database already running on port 3307.
)

REM ---------- 3. First-time database creation ----------
node "database\check-db.js"
if errorlevel 1 (
  echo [i] Creating the database and demo data ^(first run only^)...
  call npm run setup
  if errorlevel 1 (
    echo [!] Database setup failed. See the messages above.
    pause
    exit /b 1
  )
)

REM ---------- 4. Web application on port 3000 ----------
call :port_open 3000
if errorlevel 1 (
  echo [i] Starting the web application ^(API on port 3000^)...
  start "Class Attendance - API server (keep this window open)" cmd /k "npm start"
  call :wait_port 3000 20
  if errorlevel 1 (
    echo [!] The web application did not start. Check the API window for errors.
    pause
    exit /b 1
  )
) else (
  echo [ok] Web application already running on port 3000.
)

REM ---------- 5. Open the browser ----------
echo.
echo [ok] Opening http://localhost:3000 in your browser...
start "" "http://localhost:3000"
echo.
echo ----------------------------------------------------------
echo  Two server windows are now running:
echo    1. Class Attendance - MySQL       (the database)
echo    2. Class Attendance - API server  (the web application)
echo  KEEP BOTH WINDOWS OPEN while presenting.
echo  Close them when you are finished.
echo ----------------------------------------------------------
ping -n 7 127.0.0.1 >nul
exit /b 0

:port_open
netstat -ano | findstr /r /c:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:wait_port
set /a _left=%~2
:wp_loop
call :port_open %~1
if not errorlevel 1 exit /b 0
set /a _left-=1
if %_left% leq 0 exit /b 1
ping -n 2 127.0.0.1 >nul
goto :wp_loop
