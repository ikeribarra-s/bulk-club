# Contexto del proyecto — Control de acceso a molinete por QR

## Objetivo
Permitir que un usuario escanee un código QR desde una web app y, si es válido,
se abra un molinete tripode Hikvision. La validación del QR y el registro de
accesos ya están implementados en el backend. Falta integrar la apertura física
del molinete.

## Arquitectura

```
[Web app usuario]
      │ escanea QR
      ▼
[Backend FastAPI en Render (nube)]
      │  - valida el QR contra la DB
      │  - registra el acceso en la DB
      │  - si OK, manda orden de apertura
      ▼
[Agente local en la red del molinete]  ◄── conexión saliente (WebSocket) hacia el backend
      │  - recibe la orden
      │  - traduce a comando ISAPI
      ▼
[Molinete Hikvision DS-K3M230 @ 192.168.1.202]
      │  - abre la puerta
```

El backend NO puede alcanzar el molinete directamente (IP privada, red local).
Por eso existe un **agente local**: una máquina en la misma red que el molinete,
que mantiene una conexión saliente (WebSocket) hacia el backend en Render y
ejecuta las órdenes de apertura. No se abren puertos en el router.

## Dispositivo: Hikvision DS-K3M230-G301X
- Tipo: panel de control de molinete tripode (threeRollerGate, PersonnelChannel)
- IP: 192.168.1.202
- Firmware: V3.0.0 build 240308
- API: ISAPI (HTTP REST sobre la red local)
- Autenticación: HTTP Digest

### Comando de apertura (CONFIRMADO funcionando)
```
PUT http://192.168.1.202/ISAPI/AccessControl/RemoteControl/door/1
Content-Type: application/xml
Auth: Digest
Body: <RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>
```
- `door/1` = sentido entrada. `door/2` = sentido salida (confirmar cuál es cuál).
- Comandos disponibles en `<cmd>`: open, close, alwaysOpen, alwaysClose, stop.
- Respuesta OK: statusCode 1, statusString "OK".

### Función de referencia (Python)
```python
import requests
from requests.auth import HTTPDigestAuth

def abrir_molinete(ip, user, password, door=1, timeout=5):
    url = f"http://{ip}/ISAPI/AccessControl/RemoteControl/door/{door}"
    body = "<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>"
    r = requests.put(
        url, data=body,
        auth=HTTPDigestAuth(user, password),
        headers={"Content-Type": "application/xml"},
        timeout=timeout,
    )
    return r.status_code == 200
```

### Consultar eventos del molinete (para auditoría)
```
POST http://192.168.1.202/ISAPI/AccessControl/AcsEvent?format=json
Body: {"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":10,"major":0,"minor":0}}
```

## Lo que hay que construir

### 1. Agente local
- Mantiene conexión WebSocket saliente hacia el backend (wss://).
- Se autentica con un token secreto.
- Reconexión automática si se cae la conexión (retry cada pocos segundos).
- Heartbeat/ping para detectar conexiones muertas.
- Al recibir orden de apertura, llama `abrir_molinete()`.
- Logging local a archivo de cada apertura (timestamp, resultado).
- Idempotencia: evitar doble apertura si llega la orden duplicada.
- Corre como servicio del sistema (arranque automático).

### 2. Backend (extensión de lo existente)
- Endpoint WebSocket para que el agente se conecte (con auth por token).
- Cuando se valida un QR OK (lógica ya existente), enviar orden de apertura
  al agente por el WebSocket abierto.
- Manejar el caso de agente desconectado (responder error al usuario).

## Notas importantes
- Credenciales del molinete: usar un **usuario operador** con permisos solo de
  control de puerta, NO el admin. Crear desde la web del .202.
- Configuración sensible (IP, credenciales, token) via variables de entorno,
  nunca hardcodeada.
- El beep de "acceso permitido" se resolverá después (no es parte de este scope).
  El molinete abre sin sonido por este método; el sonido se agregará vía un
  zumbador en el agente más adelante.

## Stack
- Backend: Python + FastAPI (en Render)
- Agente: Python (máquina local en la red del molinete)
- Comunicación backend↔agente: WebSocket seguro (wss)
- Comunicación agente↔molinete: HTTP ISAPI (Digest auth)
