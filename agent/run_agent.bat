@echo off
rem Bulk Club - agente local del molinete.
rem Crea el venv la primera vez y relanza el agente si se cierra por error.
cd /d %~dp0

if not exist .venv (
    echo Creando entorno virtual...
    py -m venv .venv
    .venv\Scripts\python -m pip install --upgrade pip
    .venv\Scripts\pip install -r requirements.txt
)

:loop
.venv\Scripts\python door_agent.py
echo El agente termino (codigo %errorlevel%). Reinicio en 5 segundos...
timeout /t 5 /nobreak >nul
goto loop
