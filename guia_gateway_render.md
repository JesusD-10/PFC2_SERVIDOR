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

## Configuración exacta para la primera prueba

Para esta primera prueba se utilizará únicamente el nodo:

```text
NODE-002
```

Antes de enviar datos, la red debe estar configurada en el Dashboard y debe existir `NODE-002`. Si el nodo todavía no existe, entrar a **Ubicaciones**, configurar la red y guardar al menos dos nodos: la subestación `NODE-001` y el nodo de prueba `NODE-002`.

El gateway debe configurar estos valores:

```text
Protocolo: HTTPS
Servidor: dashboard-operativo-integral.onrender.com
Puerto: 443
Método: POST
Ruta: /api/v1/gateway/telemetry
Content-Type: application/json
gateway_id: GATEWAY-001
node_id: NODE-002
```

La URL completa de envío es:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry
```

No es necesario escribir `:443`, porque HTTPS utiliza ese puerto automáticamente. Esta URL es para enviar datos del gateway, no para abrir la página visual.

## Integración TEKTELIC LoRaWAN

El Network Server de TEKTELIC envuelve los datos del decoder dentro de `payload` y la información de radio dentro de `payloadMetaData`. Por eso, para TEKTELIC se debe utilizar esta ruta específica:

```text
POST https://dashboard-operativo-integral.onrender.com/api/v1/lorawan/telemetry
```

Configuración del webhook o integración HTTP:

```text
Protocolo: HTTPS
Servidor: dashboard-operativo-integral.onrender.com
Puerto: 443
Método: POST
Ruta: /api/v1/lorawan/telemetry
Content-Type: application/json
```

La ruta `/api/v1/gateway/telemetry` espera los datos directamente en la raíz. La ruta `/api/v1/lorawan/telemetry` es la que traduce automáticamente el formato fijo de TEKTELIC al formato interno del Dashboard.

### Formato TEKTELIC esperado

Para la primera prueba, el gateway y el nodo deben estar dentro de `payload`:

```json
{
  "payload": {
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-002",
    "voltage_v": 220.4,
    "current_a": 18.6,
    "power_kw": 4.1,
    "energy_kwh": 125.8,
    "temperature_c": 36.5,
    "humidity_pct": 57.2,
    "load_percentage": 48,
    "response_time_ms": 220,
    "status": "OK",
    "alarm": null
  },
  "payloadMetaData": {
    "fcount": 1024,
    "gatewayMetaDataList": [
      {
        "rxInfo": {
          "rssi": -70,
          "loRaSNR": 7.5,
          "frequency": 915000000,
          "dataRate": {
            "spreadFactor": 7
          }
        }
      }
    ]
  }
}
```

Campos indispensables para esta prueba:

```text
payload.gateway_id = GATEWAY-001
payload.node_id = NODE-002
payload.status = OK
```

El servidor también extrae desde `payloadMetaData` los datos de calidad LoRaWAN: RSSI, SNR, frecuencia, spreading factor y `fcount`.

### Prueba TEKTELIC con PowerShell

```powershell
$body = @{
  payload = @{
    gateway_id = "GATEWAY-001"
    node_id = "NODE-002"
    voltage_v = 220.4
    current_a = 18.6
    power_kw = 4.1
    energy_kwh = 125.8
    temperature_c = 36.5
    humidity_pct = 57.2
    load_percentage = 48
    response_time_ms = 220
    status = "OK"
    alarm = $null
  }
  payloadMetaData = @{
    fcount = 1024
    gatewayMetaDataList = @(
      @{
        rxInfo = @{
          rssi = -70
          loRaSNR = 7.5
          frequency = 915000000
          dataRate = @{ spreadFactor = 7 }
        }
      }
    )
  }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Uri "https://dashboard-operativo-integral.onrender.com/api/v1/lorawan/telemetry" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

La respuesta correcta es HTTP `202` con `source: "lorawan"`. Si responde `400` con `payload invalido`, verificar que `gateway_id` y `node_id` estén dentro de `payload`, no en la raíz.

No utilizar estas rutas para las lecturas eléctricas:

```text
https://dashboard-operativo-integral.onrender.com/
https://dashboard-operativo-integral.onrender.com/mobile
https://dashboard-operativo-integral.onrender.com/api/v1/location
```

La primera es el Dashboard, la segunda es el modo técnico web y la tercera es para la ubicación GPS del teléfono del técnico.

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

## Formato exacto del primer envío

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
    "humidity_pct": 57.2,
    "load_percentage": 48,
    "response_time_ms": 220
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

El endpoint ya está implementado en `server.js`. Recibe la lectura, la guarda como última lectura del nodo, actualiza el Dashboard cuando el modo es `gateway` y emite `telemetry_update` por Socket.IO.

La respuesta exitosa es HTTP `202`:

```json
{
  "ok": true,
  "source": "gateway",
  "reading": {
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-002",
    "status": "OK"
  }
}
```

Una respuesta HTTP `400` normalmente significa que `NODE-002` no existe todavía en la configuración, que falta `gateway_id` o que el estado no es válido.

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

## Cambiar el Dashboard a Gateway real

Actualmente el servidor utiliza funciones como:

```javascript
simulateNodeState()
generateTelemetryData()
```

El plan recomendado es hacerlo por etapas.

### Seleccionar la fuente

El Dashboard ya tiene un selector `Fuente` con estas opciones:

```text
Simulación
Gateway real
```

Para esta prueba seleccionar **Gateway real**. También puede cambiarse mediante API:

```http
POST https://dashboard-operativo-integral.onrender.com/api/v1/telemetry-mode
Content-Type: application/json

{"source":"gateway"}
```

Para volver a simulación:

```json
{"source":"simulator"}
```

Consultar el modo actual:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/telemetry-mode
```

En modo `gateway`, el servidor no genera fallas simuladas. El Dashboard espera las lecturas enviadas por el gateway.

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

## Autenticación para esta primera prueba

Para esta primera prueba no se debe enviar `X-Gateway-Key`, porque la validación de API key todavía no está activa en el servidor. La seguridad actual se basa en validar el `gateway_id`, el `node_id`, el estado y la estructura de la lectura.

La API key puede agregarse posteriormente como una mejora de seguridad. No debe configurarse en el gateway hasta que también se implemente su validación en `server.js`.

Aunque no se usa todavía para autorizar, se recomienda mantener un `gateway_id` único por equipo y no compartirlo entre gateways.

## Prueba manual exclusiva para NODE-002

Con la red configurada y el Dashboard en modo **Gateway real**, probar desde PowerShell:

```powershell
$body = @{
  gateway_id = "GATEWAY-001"
  node_id = "NODE-002"
  timestamp = "2026-09-10T18:00:00.000Z"
  measurements = @{
    voltage_v = 220.4
    current_a = 18.6
    power_kw = 4.1
    energy_kwh = 125.8
    temperature_c = 36.5
    humidity_pct = 57.2
    load_percentage = 48
    response_time_ms = 220
  }
  status = "OK"
  alarm = $null
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Respuesta esperada:

```json
{
  "ok": true,
  "source": "gateway",
  "reading": {
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-002",
    "status": "OK",
    "measurements": {
      "voltage_v": 220.4,
      "current_a": 18.6,
      "power_kw": 4.1,
      "energy_kwh": 125.8,
      "temperature_c": 36.5,
      "humidity_pct": 57.2,
      "load_percentage": 48,
      "response_time_ms": 220
    }
  }
}
```

La URL responde cuando existe una red configurada con los nodos enviados en `node_id`.

## Prueba de falla en NODE-002

Después de comprobar una lectura `OK`, enviar una lectura crítica para verificar la alarma del Dashboard:

```json
{
  "gateway_id": "GATEWAY-001",
  "node_id": "NODE-002",
  "timestamp": "2026-09-10T18:03:00.000Z",
  "status": "CRITICAL",
  "measurements": {
    "voltage_v": 178.2,
    "current_a": 42.8,
    "power_kw": 7.6,
    "energy_kwh": 128.1,
    "temperature_c": 81.4,
    "humidity_pct": 68.9,
    "load_percentage": 94,
    "response_time_ms": 1200
  },
  "distance_km": 0.5,
  "alarm": {
    "code": "OVERLOAD",
    "message": "Sobrecarga detectada",
    "severity": "CRITICAL"
  }
}
```

Resultado esperado:

1. `NODE-002` cambia a estado `CRITICAL`.
2. El Dashboard recibe `telemetry_update`.
3. Se registra una alerta en **Alertas**.
4. Aparece la alarma parpadeante en la esquina inferior izquierda.
5. El gráfico y el mapa muestran el nodo afectado.

Para simular la recuperación, enviar nuevamente el mismo JSON cambiando:

```json
"status": "OK",
"alarm": null
```

La alarma del Dashboard desaparecerá cuando todos los nodos reporten estado `OK`.

## Prueba desde el gateway con curl: NODE-002

```bash
curl -X POST \
  "https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry" \
  -H "Content-Type: application/json" \
  -d '{
    "gateway_id": "GATEWAY-001",
    "node_id": "NODE-002",
    "timestamp": "2026-09-10T18:00:00.000Z",
    "measurements": {
      "voltage_v": 220.4,
      "current_a": 18.6,
      "power_kw": 4.1,
      "energy_kwh": 125.8,
      "temperature_c": 36.5,
      "humidity_pct": 57.2,
      "load_percentage": 48,
      "response_time_ms": 220
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

Para desplegar cambios posteriores:

1. Modificar `server.js` o la interfaz.
2. Ejecutar `node --check server.js`.
3. Probar el POST con PowerShell o `curl`.
4. Crear un commit.
5. Hacer push a `main`.
6. Esperar el despliegue automático de Render.
7. Probar nuevamente la URL pública.

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
- [ ] Utiliza `NODE-002` para esta primera prueba.
- [ ] Reintenta si Render no responde.

### Servidor

- [x] Crear `POST /api/v1/gateway/telemetry`.
- [ ] Agregar API key en una etapa posterior.
- [x] Validar `gateway_id`.
- [x] Validar `node_id`.
- [x] Validar el estado `OK`, `WARNING` o `CRITICAL`.
- [x] Guardar la última lectura por nodo.
- [x] Convertir la lectura al formato `geo_nodes`.
- [x] Emitir `telemetry_update`.
- [x] Registrar alertas cuando `status` sea `WARNING` o `CRITICAL`.
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
https://dashboard-operativo-integral.onrender.com/api/v1/lorawan/telemetry
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

Para un gateway HTTP que ya envía el formato interno, la URL es:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/gateway/telemetry
```

Para TEKTELIC mediante Network Server LoRaWAN, la URL correcta es:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/lorawan/telemetry
```

Esta ruta ya está implementada en `server.js` y traduce `payload` y `payloadMetaData`. Para la primera prueba se debe configurar `NODE-002`, enviar el JSON TEKTELIC indicado y comprobar la respuesta HTTP `202` con `source: "lorawan"`.
