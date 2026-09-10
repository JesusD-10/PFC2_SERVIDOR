# Guía de integración del gateway con el Dashboard en Render

## Objetivo

Esta guía explica cómo conectar el gateway eléctrico real con el backend del Dashboard desplegado en Render.

Actualmente el servidor utiliza una simulación interna para generar datos de telemetría. El objetivo de la integración es reemplazar progresivamente esa simulación por lecturas reales provenientes del gateway.

El gateway puede enviar al servidor:

- Voltaje.
- Corriente.
- Potencia.
- Consumo.
- Temperatura.
- Humedad.
- Estado del nodo.
- Alarmas o fallas.
- Fecha y hora de la lectura.

## URLs del sistema desplegado

Dashboard visual:

```text
https://dashboard-operativo-integral.onrender.com/
```

Modo técnico web:

```text
https://dashboard-operativo-integral.onrender.com/mobile
```

API de salud:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/health
```

Configuración de red y nodos:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/network
```

Envío de ubicación del técnico:

```text
POST https://dashboard-operativo-integral.onrender.com/api/v1/location
```

Última ubicación del técnico:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/location/latest
```

## Arquitectura recomendada

La opción recomendada es que el gateway envíe sus lecturas al servidor mediante HTTPS:

```text
Sensores eléctricos
        |
        v
Gateway local
        |
        | HTTPS POST
        v
API Node.js en Render
        |
        | normalización de datos
        v
Socket.IO
        |
        v
Dashboard web
```

El gateway no debe enviar datos a la página visual:

```text
https://dashboard-operativo-integral.onrender.com/
```

Debe enviar datos a un endpoint de API específico, por ejemplo:

```text
POST https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry
```

Esta ruta ya está implementada en el servidor. El endpoint de ubicación móvil existente (`/api/v1/location`) es para el teléfono del técnico y no debe utilizarse para las lecturas eléctricas del gateway.

En el Dashboard se puede cambiar la fuente de datos desde el selector `Fuente`:

```text
Simulación
Gateway real
```

También se puede consultar el modo actual mediante:

```text
GET /api/v1/telemetry-mode
```

Y cambiarlo mediante:

```text
POST /api/v1/telemetry-mode
Content-Type: application/json

{
  "source": "gateway"
}
```

Los valores válidos son `simulator` y `gateway`.

## Dos formas de integración

### Opción A: el gateway envía datos al servidor

Es la opción recomendada cuando el gateway puede realizar peticiones HTTP o HTTPS.

```text
Gateway -> POST /api/v1/gateway/telemetry -> Render
```

Ventajas:

- El gateway no necesita aceptar conexiones externas.
- No se requiere abrir puertos en el router local.
- Render recibe cada lectura cuando está disponible.
- Funciona mejor con redes privadas y conexiones móviles.

### Opción B: Render consulta al gateway

Solo es posible si el gateway tiene una dirección accesible desde Internet o una VPN:

```text
Render -> GET /api del gateway
```

No se debe utilizar `localhost` ni una IP privada como `192.168.x.x` desde Render. Esas direcciones solo funcionan dentro de la red local.

Por seguridad y facilidad de despliegue, se recomienda implementar la opción A.

## Identificación de los nodos

Cada lectura debe indicar a qué nodo pertenece. El gateway debe utilizar los IDs definidos en la configuración del Dashboard:

```text
NODE-001
NODE-002
NODE-003
```

Para consultar los IDs actuales:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/network
```

La aplicación debe combinar:

```text
networkConfig.substation
networkConfig.nodes
```

La subestación también utiliza el formato `NODE-001`.

No se deben enviar nombres ambiguos como `nodo1`, `central`, `poste-5` o `barranco-norte` si el Dashboard tiene registrado otro ID.

## Formato recomendado para el gateway

El gateway debería enviar un JSON como este:

```json
{
  "gateway_id": "GATEWAY-001",
  "node_id": "NODE-002",
  "timestamp": "2026-09-09T18:00:00.000Z",
  "measurements": {
    "voltage_v": 220.4,
    "current_a": 18.6,
    "power_kw": 4.1,
    "energy_kwh": 125.8,
    "temperature_c": 36.5,
    "humidity_pct": 57.2
  },
  "status": "OK",
  "alarm": null
}
```

Cuando exista una falla:

```json
{
  "gateway_id": "GATEWAY-001",
  "node_id": "NODE-002",
  "timestamp": "2026-09-09T18:03:00.000Z",
  "measurements": {
    "voltage_v": 178.2,
    "current_a": 42.8,
    "power_kw": 7.6,
    "energy_kwh": 128.1,
    "temperature_c": 81.4,
    "humidity_pct": 68.9
  },
  "status": "CRITICAL",
  "alarm": {
    "code": "OVERLOAD",
    "message": "Sobrecarga detectada",
    "severity": "CRITICAL"
  }
}
```

## Campos mínimos

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---:|---|
| `gateway_id` | String | Sí | Identificador físico o lógico del gateway. |
| `node_id` | String | Sí | Nodo al que pertenece la lectura. |
| `timestamp` | String | Sí | Fecha y hora ISO 8601. |
| `measurements` | Object | Sí | Valores eléctricos medidos. |
| `status` | String | Sí | `OK`, `WARNING` o `CRITICAL`. |
| `alarm` | Object/null | No | Información de alarma activa. |

Valores aceptados para `status`:

```text
OK
WARNING
CRITICAL
```

El gateway debe utilizar siempre la misma unidad:

- Voltaje: voltios (`V`).
- Corriente: amperios (`A`).
- Potencia: kilovatios (`kW`).
- Energía: kilovatios-hora (`kWh`).
- Temperatura: grados Celsius (`°C`).
- Humedad: porcentaje (`%`).

## Endpoint de telemetría del gateway

La ruta recomendada es:

```text
POST /api/v1/gateway/telemetry
```

Ejemplo de implementación inicial en `server.js`:

```javascript
app.post('/api/v1/gateway/telemetry', (req, res) => {
  const payload = req.body || {};
  const measurements = payload.measurements || {};
  const nodeId = String(payload.node_id || '');
  const gatewayId = String(payload.gateway_id || '');
  const status = String(payload.status || 'OK').toUpperCase();

  const configuredNodeIds = networkConfig
    ? [networkConfig.substation, ...networkConfig.nodes].map((node, index) => (
        node.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`
      ))
    : [];

  if (!gatewayId || !nodeId || !configuredNodeIds.includes(nodeId)) {
    return res.status(400).json({
      error: 'El gateway y el nodo deben estar registrados en la red.'
    });
  }

  if (!['OK', 'WARNING', 'CRITICAL'].includes(status)) {
    return res.status(400).json({
      error: 'El estado debe ser OK, WARNING o CRITICAL.'
    });
  }

  const telemetryReading = {
    gateway_id: gatewayId,
    node_id: nodeId,
    timestamp: payload.timestamp || formatTimestamp(),
    status,
    measurements: {
      voltage_v: Number(measurements.voltage_v || 0),
      current_a: Number(measurements.current_a || 0),
      power_kw: Number(measurements.power_kw || 0),
      energy_kwh: Number(measurements.energy_kwh || 0),
      temperature_c: Number(measurements.temperature_c || 0),
      humidity_pct: Number(measurements.humidity_pct || 0)
    },
    alarm: payload.alarm || null
  };

  io.emit('gateway_telemetry', telemetryReading);

  return res.status(202).json({
    ok: true,
    received_at: formatTimestamp(),
    reading: telemetryReading
  });
});
```

El endpoint recibe la lectura, la guarda como última lectura del nodo, actualiza el objeto `latestTelemetry` cuando el modo seleccionado es `gateway` y emite `telemetry_update` por Socket.IO.

## Normalización de datos

El Dashboard actual consume un objeto general de telemetría con esta estructura:

```json
{
  "timestamp": "2026-09-09T18:00:00.000Z",
  "system_status": "NORMAL",
  "metrics": {
    "total_operations": 1500,
    "efficiency_percentage": 94.2,
    "active_alerts_count": 0,
    "risk_level": "BAJO"
  },
  "geo_nodes": [],
  "telemetry_stream": {},
  "predictive_model": {},
  "fault_context": {}
}
```

El endpoint del gateway debería convertir cada lectura real a un nodo dentro de `geo_nodes`:

```json
{
  "id": "NODE-002",
  "name": "Nodo Surquillo",
  "district": "Surquillo",
  "lat": -12.105,
  "lng": -77.025,
  "status": "CRITICAL",
  "load_percentage": 92,
  "response_time_ms": 420,
  "temperature_c": 81.4,
  "humidity_pct": 68.9,
  "distance_km": 0,
  "fault_curve": [],
  "life_status": "Crítico",
  "exact_location": "Av. Angamos"
}
```

La configuración de red aporta los datos fijos:

```text
id
name
 district
lat
lng
exact_location
```

El gateway aporta los datos variables:

```text
status
load_percentage
response_time_ms
temperature_c
humidity_pct
fault_curve
```

No se deben reemplazar las coordenadas configuradas por datos del gateway si el gateway no mide GPS del nodo. Las coordenadas del nodo son fijas y las coordenadas del técnico son variables.

## Cómo reemplazar el simulador

Actualmente el servidor utiliza funciones como:

```javascript
simulateNodeState()
generateTelemetryData()
```

El plan recomendado es hacerlo por etapas.

### Etapa 1: conservar el simulador como respaldo

Agregar una variable de entorno en Render:

```text
TELEMETRY_SOURCE=simulator
```

Cuando el gateway esté listo, cambiarla a:

```text
TELEMETRY_SOURCE=gateway
```

Durante la transición:

```javascript
const telemetrySource = process.env.TELEMETRY_SOURCE || 'simulator';
```

Esto permite volver al simulador si el gateway pierde comunicación.

### Etapa 2: guardar la última lectura real

Crear una variable en memoria inicialmente:

```javascript
let latestGatewayReadings = new Map();
```

Cuando llegue una lectura:

```javascript
latestGatewayReadings.set(telemetryReading.node_id, telemetryReading);
```

En una versión de producción se debe reemplazar el `Map` por PostgreSQL, Redis u otra base de datos.

### Etapa 3: construir la telemetría del Dashboard

Crear una función que combine:

```text
networkConfig
latestGatewayReadings
```

La función debe generar:

```text
geo_nodes
metrics
system_status
fault_context
```

### Etapa 4: emitir al navegador

Cuando llega una lectura real:

```javascript
io.emit('telemetry_update', dashboardTelemetry);
```

El Dashboard ya escucha el evento existente:

```text
telemetry_update
```

De esta manera no es necesario que el navegador consulte directamente al gateway.

## Frecuencia de envío

El gateway puede enviar lecturas cada:

```text
5 segundos
10 segundos
30 segundos
1 minuto
```

La frecuencia debe depender del proyecto y de la capacidad del dispositivo.

El intervalo actual de 3 minutos pertenece a la simulación interna del servidor. Cuando se utilice el gateway real, las lecturas deben actualizarse cuando el gateway las envíe, en lugar de esperar el ciclo del simulador.

No conviene que el gateway espere 3 minutos si se necesita detectar una falla rápidamente.

Una configuración inicial razonable sería:

```text
Lectura de sensores: cada 10 segundos
Envío al servidor: cada 10 segundos
Timeout de gateway: 60 segundos
```

Si no llega una lectura dentro del timeout, el servidor puede marcar el nodo como:

```text
WARNING
```

## Autenticación recomendada

No se recomienda dejar el endpoint del gateway completamente abierto.

En Render agregar una variable de entorno:

```text
GATEWAY_API_KEY=una-clave-larga-y-secreta
```

El gateway debe enviar un header:

```text
X-Gateway-Key: una-clave-larga-y-secreta
```

El servidor debe validar el header antes de aceptar datos:

```javascript
const providedKey = req.get('X-Gateway-Key');

if (!providedKey || providedKey !== process.env.GATEWAY_API_KEY) {
  return res.status(401).json({ error: 'Gateway no autorizado.' });
}
```

La clave no debe escribirse directamente en el código que se publica en GitHub.

Recomendaciones adicionales:

- Utilizar una clave diferente por gateway.
- No mostrar la clave en la interfaz web.
- Rotar la clave si se filtra.
- Registrar el `gateway_id` que envía cada lectura.
- Rechazar gateways desconocidos.
- Validar límites razonables de voltaje, corriente y temperatura.

## Prueba manual del endpoint

Después de implementar la ruta, probar desde PowerShell:

```powershell
$body = @{
  gateway_id = "GATEWAY-001"
  node_id = "NODE-001"
  timestamp = "2026-09-09T18:00:00.000Z"
  measurements = @{
    voltage_v = 220.4
    current_a = 18.6
    power_kw = 4.1
    energy_kwh = 125.8
    temperature_c = 36.5
    humidity_pct = 57.2
  }
  status = "OK"
  alarm = $null
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ "X-Gateway-Key" = "CLAVE_DE_PRUEBA" } `
  -Body $body
```

Respuesta esperada:

```json
{
  "ok": true,
  "received_at": "2026-09-09T18:00:01.000Z",
  "reading": {
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-001",
    "status": "OK"
  }
}
```

La URL responde cuando existe una red configurada con los nodos enviados en `node_id`.

## Prueba desde el gateway con curl

```bash
curl -X POST \
  "https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry" \
  -H "Content-Type: application/json" \
  -H "X-Gateway-Key: CLAVE_DE_PRUEBA" \
  -d '{
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-001",
    "timestamp": "2026-09-09T18:00:00.000Z",
    "measurements": {
      "voltage_v": 220.4,
      "current_a": 18.6,
      "power_kw": 4.1,
      "energy_kwh": 125.8,
      "temperature_c": 36.5,
      "humidity_pct": 57.2
    },
    "status": "OK",
    "alarm": null
  }'
```

## Consideraciones de Render

El servicio está configurado en `render.yaml` con:

```text
Build: npm ci
Start: npm start
Health check: /api/v1/health
Auto deploy: commit
```

Después de agregar el endpoint:

1. Modificar `server.js`.
2. Probar localmente.
3. Ejecutar `node --check server.js`.
4. Probar el POST con PowerShell o curl.
5. Crear un commit.
6. Hacer push a `main`.
7. Esperar el despliegue automático de Render.
8. Probar nuevamente la URL pública.

URL del repositorio:

```text
https://github.com/JesusD-10/PFC2_SERVIDOR
```

URL del Dashboard:

```text
https://dashboard-operativo-integral.onrender.com/
```

Render puede suspender temporalmente servicios gratuitos cuando no reciben tráfico. El primer request después de un periodo sin uso puede tardar más de lo normal.

## Limitaciones actuales

Antes de conectar el gateway real, se deben tener presentes estas limitaciones del proyecto actual:

- La telemetría simulada todavía se genera en `server.js`.
- Existe `POST /api/v1/gateway/telemetry` y acepta lecturas `OK`, `WARNING` y `CRITICAL`.
- El Dashboard permite cambiar entre `simulator` y `gateway` desde el selector `Fuente`.
- La red configurada se guarda en memoria.
- Las lecturas del gateway se perderían si el proceso se reinicia, salvo que se agregue una base de datos.
- Las ubicaciones del técnico también se guardan temporalmente en memoria.
- Socket.IO ya existe para el Dashboard, pero el formato final de telemetría real debe normalizarse antes de emitir `telemetry_update`.

## Checklist de implementación

### Gateway

- [ ] Tiene un `gateway_id` único.
- [ ] Conoce el `node_id` configurado.
- [ ] Lee los sensores correctamente.
- [ ] Usa unidades consistentes.
- [ ] Genera timestamp ISO 8601.
- [ ] Puede conectarse a Internet.
- [ ] Puede realizar HTTPS POST.
- [ ] Envía el header de autenticación.
- [ ] Reintenta si Render no responde.

### Servidor

- [ ] Crear `POST /api/v1/gateway/telemetry`.
- [ ] Validar API key.
- [ ] Validar `gateway_id`.
- [ ] Validar `node_id`.
- [ ] Validar rangos de las mediciones.
- [ ] Guardar la última lectura por nodo.
- [ ] Convertir la lectura al formato `geo_nodes`.
- [ ] Emitir `telemetry_update`.
- [ ] Registrar alertas cuando `status` sea `WARNING` o `CRITICAL`.
- [ ] Implementar timeout de comunicación.

### Dashboard

- [ ] Mostrar la lectura real recibida.
- [ ] Mostrar timestamp real.
- [ ] Mostrar el estado del nodo.
- [ ] Activar la alarma cuando exista una falla.
- [ ] Mantener separadas las coordenadas del nodo y del técnico.
- [ ] Mostrar la posición enviada desde Android.

## Resumen final

La página desplegada no debe recibir directamente conexiones desde los sensores. La conexión debe realizarse así:

```text
Gateway
  |
  | HTTPS POST con JSON
  v
https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry
  |
  | Normalización en Node.js
  v
Socket.IO: telemetry_update
  |
  v
Dashboard web
```

La URL visual del Dashboard es para los usuarios:

```text
https://dashboard-operativo-integral.onrender.com/
```

La URL `/mobile` es para el técnico:

```text
https://dashboard-operativo-integral.onrender.com/mobile
```

La URL que debe utilizar el gateway para enviar datos es:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry
```

Esta última ruta debe implementarse en `server.js` antes de conectar el gateway real.
