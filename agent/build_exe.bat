@echo off
rem Compila Molinete.exe (GUI) con PyInstaller. Resultado: dist\Molinete.exe
cd /d %~dp0

if not exist .venv (
    echo Creando entorno virtual...
    py -m venv .venv
)
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\pip install -r requirements.txt pyinstaller

.venv\Scripts\pyinstaller --noconfirm --onefile --windowed --name Molinete molinete_app.py

echo.
echo Listo: dist\Molinete.exe
pause
