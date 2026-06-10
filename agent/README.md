# Molinete — Agente local del molinete

Corre en la PC del gimnasio que tiene Ethernet hacia el molinete Hikvision
(DS-K3M230 @ 192.168.1.202). Mantiene una conexión WebSocket **saliente** hacia
el backend en Render — no hace falta abrir puertos en el router.

Hay dos versiones sobre el mismo núcleo (`molinete_core.py`):

- **`molinete_app.py`** — app con interfaz gráfica (tkinter), pensada para
  compilarse como `Molinete.exe` y dejarse corriendo en la PC del gimnasio.
- **`door_agent.py`** — versión consola, config por `.env` (útil en desarrollo).

## Compilar Molinete.exe

En cualquier PC con Python 3.11+:

```
agent\build_exe.bat
```

Genera `agent\dist\Molinete.exe` (un solo archivo, sin instalador). Copiar ese
exe a la PC del gimnasio — no necesita Python instalado.

## Uso de Molinete.exe

1. Abrir `Molinete.exe`.
2. Completar la configuración:
   - **URL del backend** — `wss://TU-BACKEND.onrender.com/api/door/ws`
   - **Token del agente** — mismo valor que `DOOR_AGENT_TOKEN` en Render.
     Generar con `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   - **IP / usuario / contraseña del molinete** — crear un usuario **operador**
     en la web del molinete (`http://192.168.1.202`) con permiso solo de
     control de puerta. No usar el admin.
   - **Puerta** — 1 = entrada, 2 = salida.
3. Click en **Guardar y reconectar**. El punto de estado debe pasar a verde
   ("Conectado al backend").
4. Marcar **Iniciar con Windows** para que arranque solo al prender la PC
   (se registra en `HKCU\...\Run`).
5. **Probar apertura** dispara el comando ISAPI directo al molinete (sin pasar
   por el backend) — sirve para verificar credenciales y red.

La config queda en `%APPDATA%\Molinete\config.json` y el log de actividad
(cada apertura con timestamp y resultado) en `%APPDATA%\Molinete\molinete.log`.

En Render, además, setear `DOOR_CONTROL_ENABLED=true` y `DOOR_AGENT_TOKEN`.
Sin `DOOR_CONTROL_ENABLED` el backend valida QRs igual que antes pero no manda
órdenes de apertura (útil en desarrollo).

## Versión consola (desarrollo)

Copiar `.env.example` a `.env`, completar, y:

```
python door_agent.py
```

(o `run_agent.bat`, que crea el venv y reinicia el proceso si se cae).
Con `MOLINETE_MOCK=true` simula las aperturas sin hardware.

## Verificación punta a punta

- `GET /api/door/status` (admin) — devuelve si el agente está conectado.
- `POST /api/door/open` (admin) — abre el molinete vía backend → agente.
- Escanear el QR con la cuenta de prueba (DNI `00000000`) — flujo completo.

## Protocolo (referencia)

- Backend → agente: `{"type": "open", "request_id": "<uuid>", "door": 1}`
- Agente → backend: `{"type": "ack", "request_id": "<uuid>", "ok": true, "error": null}`
- El agente ignora órdenes con `request_id` repetido (ventana de 5 min) para
  evitar dobles aperturas.
- Heartbeat: ping/pong del protocolo WebSocket cada 20 s; si no hay respuesta
  en 10 s el agente reconecta solo (reintento cada 5 s).
