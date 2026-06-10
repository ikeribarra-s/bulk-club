"""Molinete — agente local del molinete Hikvision con GUI (Bulk Club).

Compilable a un solo .exe con PyInstaller (ver build_exe.bat). La config se
guarda en %APPDATA%\\Molinete\\config.json y el log en la misma carpeta.
"""

import json
import logging
import os
import queue
import sys
import threading
import tkinter as tk
from logging.handlers import RotatingFileHandler
from pathlib import Path
from tkinter import messagebox, scrolledtext, ttk

from molinete_core import AgentConfig, DoorAgent, abrir_molinete

APP_NAME = "Molinete"
APP_DIR = Path(os.environ.get("APPDATA", str(Path.home()))) / APP_NAME
CONFIG_FILE = APP_DIR / "config.json"
LOG_FILE = APP_DIR / "molinete.log"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"

STATUS_STYLES = {
    "connected": ("Conectado al backend", "#16a34a"),
    "connecting": ("Conectando...", "#d97706"),
    "disconnected": ("Desconectado — reintentando...", "#dc2626"),
    "stopped": ("Detenido", "#6b7280"),
}

logger = logging.getLogger("molinete")


# ---------- config ----------

def load_config() -> AgentConfig:
    try:
        return AgentConfig.from_dict(json.loads(CONFIG_FILE.read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError, TypeError):
        return AgentConfig()


def save_config(cfg: AgentConfig) -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg.to_dict(), indent=2), encoding="utf-8")


# ---------- autostart (registro de Windows) ----------

def _autostart_command() -> str:
    if getattr(sys, "frozen", False):  # corriendo como exe de PyInstaller
        return f'"{sys.executable}"'
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    interpreter = pythonw if pythonw.exists() else Path(sys.executable)
    return f'"{interpreter}" "{Path(__file__).resolve()}"'


def is_autostart_enabled() -> bool:
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, APP_NAME)
            return True
    except OSError:
        return False


def set_autostart(enabled: bool) -> None:
    import winreg
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, _autostart_command())
        else:
            try:
                winreg.DeleteValue(key, APP_NAME)
            except OSError:
                pass


# ---------- logging hacia archivo + GUI ----------

class QueueLogHandler(logging.Handler):
    def __init__(self, q: queue.Queue):
        super().__init__()
        self.q = q

    def emit(self, record: logging.LogRecord) -> None:
        self.q.put(("log", self.format(record)))


def setup_logging(q: queue.Queue) -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    file_handler = RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    gui_handler = QueueLogHandler(q)
    gui_handler.setFormatter(fmt)
    logger.setLevel(logging.INFO)
    logger.addHandler(file_handler)
    logger.addHandler(gui_handler)


# ---------- GUI ----------

class MolineteApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.queue: queue.Queue = queue.Queue()
        self.agent: DoorAgent | None = None
        self.agent_thread: threading.Thread | None = None

        setup_logging(self.queue)
        self.cfg = load_config()

        root.title(f"{APP_NAME} — Agente Bulk Club")
        root.geometry("620x560")
        root.minsize(560, 480)
        root.protocol("WM_DELETE_WINDOW", self.on_close)

        self._build_ui()
        self.root.after(150, self._poll_queue)

        if not self.cfg.validate():
            self.start_agent()
        else:
            logger.info("Configuración incompleta — completá los datos y guardá.")

    # --- layout ---

    def _build_ui(self) -> None:
        pad = {"padx": 8, "pady": 3}

        status_frame = ttk.Frame(self.root)
        status_frame.pack(fill="x", padx=10, pady=(10, 4))
        self.status_dot = tk.Canvas(status_frame, width=14, height=14, highlightthickness=0)
        self.status_dot.pack(side="left")
        self._dot = self.status_dot.create_oval(2, 2, 12, 12, fill="#6b7280", outline="")
        self.status_label = ttk.Label(status_frame, text="Detenido", font=("Segoe UI", 10, "bold"))
        self.status_label.pack(side="left", padx=6)

        form = ttk.LabelFrame(self.root, text="Configuración")
        form.pack(fill="x", padx=10, pady=4)
        form.columnconfigure(1, weight=1)

        self.vars = {
            "backend_ws_url": tk.StringVar(value=self.cfg.backend_ws_url),
            "agent_token": tk.StringVar(value=self.cfg.agent_token),
            "molinete_ip": tk.StringVar(value=self.cfg.molinete_ip),
            "molinete_user": tk.StringVar(value=self.cfg.molinete_user),
            "molinete_password": tk.StringVar(value=self.cfg.molinete_password),
            "molinete_door": tk.StringVar(value=str(self.cfg.molinete_door)),
            "mock": tk.BooleanVar(value=self.cfg.mock),
        }

        rows = [
            ("URL del backend (wss://...)", "backend_ws_url", None),
            ("Token del agente", "agent_token", "•"),
            ("IP del molinete", "molinete_ip", None),
            ("Usuario del molinete", "molinete_user", None),
            ("Contraseña del molinete", "molinete_password", "•"),
        ]
        for i, (label, key, mask) in enumerate(rows):
            ttk.Label(form, text=label).grid(row=i, column=0, sticky="w", **pad)
            entry = ttk.Entry(form, textvariable=self.vars[key], show=mask or "")
            entry.grid(row=i, column=1, sticky="ew", **pad)

        ttk.Label(form, text="Puerta (1=entrada, 2=salida)").grid(row=5, column=0, sticky="w", **pad)
        ttk.Spinbox(form, from_=1, to=2, width=5, textvariable=self.vars["molinete_door"]).grid(
            row=5, column=1, sticky="w", **pad
        )
        ttk.Checkbutton(
            form, text="Modo simulación (no llama al molinete)", variable=self.vars["mock"]
        ).grid(row=6, column=0, columnspan=2, sticky="w", **pad)

        buttons = ttk.Frame(self.root)
        buttons.pack(fill="x", padx=10, pady=6)
        ttk.Button(buttons, text="Guardar y reconectar", command=self.save_and_restart).pack(side="left", padx=4)
        ttk.Button(buttons, text="Probar apertura", command=self.test_open).pack(side="left", padx=4)
        self.autostart_var = tk.BooleanVar(value=is_autostart_enabled())
        ttk.Checkbutton(
            buttons, text="Iniciar con Windows", variable=self.autostart_var, command=self.toggle_autostart
        ).pack(side="right", padx=4)

        log_frame = ttk.LabelFrame(self.root, text="Actividad")
        log_frame.pack(fill="both", expand=True, padx=10, pady=(4, 10))
        self.log_text = scrolledtext.ScrolledText(log_frame, state="disabled", height=10, font=("Consolas", 9))
        self.log_text.pack(fill="both", expand=True, padx=4, pady=4)

    # --- agente ---

    def _read_form(self) -> AgentConfig:
        try:
            door = int(self.vars["molinete_door"].get())
        except ValueError:
            door = 1
        return AgentConfig(
            backend_ws_url=self.vars["backend_ws_url"].get().strip(),
            agent_token=self.vars["agent_token"].get().strip(),
            molinete_ip=self.vars["molinete_ip"].get().strip(),
            molinete_user=self.vars["molinete_user"].get().strip(),
            molinete_password=self.vars["molinete_password"].get(),
            molinete_door=door,
            mock=self.vars["mock"].get(),
        )

    def start_agent(self) -> None:
        import asyncio

        if self.agent_thread is not None and self.agent_thread.is_alive():
            return
        self.agent = DoorAgent(self.cfg, on_status=lambda s, d: self.queue.put(("status", s)))

        def runner():
            try:
                asyncio.run(self.agent.run())
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error("El agente terminó con error: %s", e)
                self.queue.put(("status", "stopped"))

        self.agent_thread = threading.Thread(target=runner, daemon=True, name="door-agent")
        self.agent_thread.start()

    def stop_agent(self, wait: float = 3.0) -> None:
        if self.agent is not None:
            self.agent.request_stop()
        if self.agent_thread is not None and self.agent_thread.is_alive():
            self.agent_thread.join(timeout=wait)
        self.agent = None
        self.agent_thread = None

    def save_and_restart(self) -> None:
        cfg = self._read_form()
        errors = cfg.validate()
        if errors:
            messagebox.showerror(APP_NAME, "Revisá la configuración:\n\n- " + "\n- ".join(errors))
            return
        self.cfg = cfg
        save_config(cfg)
        logger.info("Configuración guardada. Reconectando...")
        self.stop_agent()
        self.start_agent()

    def test_open(self) -> None:
        cfg = self._read_form()

        def worker():
            ok, error = abrir_molinete(cfg)
            self.queue.put(("test_result", (ok, error)))

        logger.info("Probando apertura manual (door=%s)...", cfg.molinete_door)
        threading.Thread(target=worker, daemon=True).start()

    def toggle_autostart(self) -> None:
        try:
            set_autostart(self.autostart_var.get())
            estado = "activado" if self.autostart_var.get() else "desactivado"
            logger.info("Inicio con Windows %s", estado)
        except OSError as e:
            messagebox.showerror(APP_NAME, f"No se pudo modificar el inicio automático:\n{e}")
            self.autostart_var.set(is_autostart_enabled())

    # --- eventos de la cola ---

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, payload = self.queue.get_nowait()
                if kind == "log":
                    self._append_log(payload)
                elif kind == "status":
                    self._set_status(payload)
                elif kind == "test_result":
                    ok, error = payload
                    if ok:
                        logger.info("Prueba de apertura: OK")
                        messagebox.showinfo(APP_NAME, "El molinete respondió OK.")
                    else:
                        logger.error("Prueba de apertura falló: %s", error)
                        messagebox.showerror(APP_NAME, f"Falló la apertura:\n{error}")
        except queue.Empty:
            pass
        self.root.after(150, self._poll_queue)

    def _append_log(self, line: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", line + "\n")
        self.log_text.see("end")
        # No dejar crecer el widget sin límite
        if int(self.log_text.index("end-1c").split(".")[0]) > 500:
            self.log_text.delete("1.0", "100.0")
        self.log_text.configure(state="disabled")

    def _set_status(self, status: str) -> None:
        text, color = STATUS_STYLES.get(status, (status, "#6b7280"))
        self.status_label.configure(text=text)
        self.status_dot.itemconfigure(self._dot, fill=color)

    def on_close(self) -> None:
        self.stop_agent(wait=2.0)
        self.root.destroy()


def main() -> None:
    root = tk.Tk()
    MolineteApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
