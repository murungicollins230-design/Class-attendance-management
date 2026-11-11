@echo off
REM -------------------------------------------------------------------
REM Starts the project's own MySQL database server on port 3307.
REM
REM First run: creates (initialises) the data directory automatically.
REM Keep this window open while the API server is running.
REM -------------------------------------------------------------------

set MYSQLD=C:\wamp64\bin\mysql\mysql8.4.7\bin\mysqld.exe
set INI=%~dp0mysql-3307.ini
set DATA=%~dp0mysql-data

if not exist "%MYSQLD%" (
  echo [!] MySQL was not found at:
  echo     %MYSQLD%
  echo     Edit the MYSQLD path in this script if you installed WAMP elsewhere.
  pause
  exit /b 1
)

if not exist "%DATA%" (
  echo [i] First run detected - initialising the project database...
  "%MYSQLD%" --defaults-file="%INI%" --initialize-insecure
  echo [ok] Database created. Login is user "root" with an empty password.
)

echo [i] Starting MySQL on port 3307  (keep this window open) ...
"%MYSQLD%" --defaults-file="%INI%" --console
