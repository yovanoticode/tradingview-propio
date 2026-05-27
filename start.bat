@echo off
cd /d "%~dp0"

echo Verificando NinjaTrader 8...
tasklist /FI "IMAGENAME eq NinjaTrader.exe" 2>nul | find /I "NinjaTrader.exe" >nul
if errorlevel 1 (
    echo Iniciando NinjaTrader 8...
    start "" "C:\Program Files\NinjaTrader 8\bin\NinjaTrader.exe"
) else (
    echo NinjaTrader ya esta corriendo.
)

echo Liberando puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /PID %%a /F 2>nul
timeout /t 1 /nobreak >nul
start "" http://localhost:3000
npm run dev
