@echo off
REM -------------------------------------------------------------------
REM Starts the project's own MySQL database server on port 3307.
REM
REM First run: creates (initialises) the data directory automatically.
REM Keep this window open while the API server is running.
REM -------------------------------------------------------------------

REM Find mysqld: prefer the WAMP installation this project was set up with,
REM then any mysqld on the PATH, then a standard MySQL 8 install.
set MYSQLD=C:\wamp64\bin\mysql\mysql8.4.7\bin\mysqld.exe
if exist "%MYSQLD%" goto :mysqld_found
set MYSQLD=
for /f "delims=" %%i in ('where mysqld 2^>nul') do if not defined MYSQLD set "MYSQLD=%%i"
if not defined MYSQLD for /d %%d in ("C:\Program Files\MySQL\MySQL Server 8.*") do if exist "%%d\bin\mysqld.exe" set "MYSQLD=%%d\bin\mysqld.exe"
if not defined MYSQLD for /d %%d in ("C:\Program Files (x86)\MySQL\MySQL Server 8.*") do if exist "%%d\bin\mysqld.exe" set "MYSQLD=%%d\bin\mysqld.exe"
:mysqld_found
set INI=%~dp0mysql-3307.ini
set DATA=%~dp0mysql-data

if not defined MYSQLD (
  echo [!] MySQL ^(mysqld.exe^) was not found on this computer.
  echo     Install MySQL 8, or edit the MYSQLD path in this script.
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
