# Integración de aplicación Android con el servidor GPS

## Objetivo

Esta guía explica cómo conectar la aplicación Android existente con el servidor del Dashboard para enviar la ubicación GPS del técnico durante una inspección.

La aplicación Android debe:

1. Consultar los nodos configurados.
2. Permitir seleccionar el nodo afectado.
3. Solicitar permiso de ubicación.
4. Obtener latitud, longitud y precisión GPS.
5. Enviar la ubicación al servidor.
6. Asociar la ubicación con el dispositivo, el nodo y una inspección.

El flujo es:

```text
Aplicación Android
        |
        | GPS del dispositivo
        v
POST /api/v1/location
        |
        v
Servidor Node.js en Render
        |
        | Socket.IO: technician_location
        v
Dashboard
```

## URL correcta de producción

La aplicación Android no debe enviar datos a la página visual `/mobile` ni a `index.html`. Debe utilizar directamente el endpoint REST:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/location
```

La URL base para Retrofit será:

```text
https://dashboard-operativo-integral.onrender.com/
```

La ruta se define en Retrofit como:

```kotlin
@POST("api/v1/location")
```

La página web `/mobile` es solamente una simulación temporal para probar el GPS desde un navegador.

## Endpoints disponibles

### Consultar la red configurada

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/network
```

Se utiliza para obtener los nodos que deben aparecer en la aplicación Android.

Ejemplo de respuesta:

```json
{
  "configured": true,
  "networkConfig": {
    "substation": {
      "id": 1,
      "nodeId": "NODE-001",
      "name": "Central eléctrica",
      "district": "La Victoria",
      "latitude": "-12.065",
      "longitude": "-77.030"
    },
    "nodes": [
      {
        "id": 2,
        "nodeId": "NODE-002",
        "name": "Nodo Surquillo",
        "district": "Surquillo",
        "latitude": "-12.105",
        "longitude": "-77.025"
      }
    ]
  }
}
```

La subestación también es un nodo y debe incluirse en la lista de selección.

### Enviar ubicación GPS

```text
POST https://dashboard-operativo-integral.onrender.com/api/v1/location
```

Header requerido:

```text
Content-Type: application/json
```

Body requerido:

```json
{
  "device_id": "ANDROID-001",
  "node_id": "NODE-002",
  "inspection_id": "INS-20260907-001",
  "latitude": -12.146520,
  "longitude": -77.022810,
  "accuracy": 4,
  "timestamp": "2026-09-07T18:00:00.000Z"
}
```

### Descripción de campos

| Campo | Tipo | Descripción |
|---|---|---|
| `device_id` | String | Identificador único del teléfono, por ejemplo `ANDROID-001`. |
| `node_id` | String | Nodo afectado, por ejemplo `NODE-002`. Debe existir en la red configurada. |
| `inspection_id` | String | Identificador de la inspección activa. |
| `latitude` | Double | Latitud GPS entre `-90` y `90`. |
| `longitude` | Double | Longitud GPS entre `-180` y `180`. |
| `accuracy` | Double | Precisión estimada del GPS en metros. |
| `timestamp` | String | Fecha y hora en formato ISO 8601. |

## Dependencias Android

En el archivo `build.gradle` del módulo `app`, agregar:

```gradle
dependencies {
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
}
```

Si el proyecto usa versiones anteriores de Gradle o Kotlin, conservar la sintaxis de dependencias que ya utilice el proyecto.

## Permisos Android

En `AndroidManifest.xml` agregar:

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <application ...>
        ...
    </application>
</manifest>
```

El permiso GPS también debe solicitarse durante la ejecución. Declararlo en el manifest no es suficiente.

Para una primera versión, la ubicación puede obtenerse cuando el usuario presiona un botón. Si después se necesita rastreo continuo en segundo plano, habrá que implementar un `Foreground Service` y revisar las restricciones de Android para `ACCESS_BACKGROUND_LOCATION`.

## Modelos Kotlin

Crear un modelo para enviar la ubicación:

```kotlin
data class LocationRequest(
    val device_id: String,
    val node_id: String,
    val inspection_id: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double,
    val timestamp: String
)
```

Crear los modelos para leer la respuesta:

```kotlin
data class LocationResponse(
    val ok: Boolean,
    val location: LocationData
)

data class LocationData(
    val id: String,
    val device_id: String,
    val node_id: String,
    val inspection_id: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Double,
    val timestamp: String
)
```

Los nombres de las propiedades deben coincidir con los nombres JSON del servidor, incluyendo `device_id`, `node_id` e `inspection_id`.

## Interfaz Retrofit

Crear `DashboardApi.kt`:

```kotlin
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface DashboardApi {

    @GET("api/v1/network")
    suspend fun getNetwork(): NetworkResponse

    @POST("api/v1/location")
    suspend fun sendLocation(
        @Body location: LocationRequest
    ): Response<LocationResponse>
}
```

Los modelos de `NetworkResponse` pueden adaptarse a la estructura que ya utilice la aplicación Android. La información importante es leer:

```text
networkConfig.substation
networkConfig.nodes
```

## Configuración de Retrofit

Crear `RetrofitProvider.kt`:

```kotlin
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitProvider {

    private const val BASE_URL =
        "https://dashboard-operativo-integral.onrender.com/"

    val api: DashboardApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(DashboardApi::class.java)
    }
}
```

La URL base debe terminar en `/`:

```text
https://dashboard-operativo-integral.onrender.com/
```

No colocar la ruta completa del endpoint como `baseUrl`. La ruta se agrega en la anotación `@POST`.

## Obtener la ubicación del teléfono

Usar `FusedLocationProviderClient`:

```kotlin
private val fusedLocationClient by lazy {
    LocationServices.getFusedLocationProviderClient(this)
}
```

Solicitar permisos:

```kotlin
private fun requestLocationPermission() {
    if (
        ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        ActivityCompat.requestPermissions(
            this,
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ),
            1001
        )
        return
    }

    getCurrentLocation()
}
```

Obtener una posición:

```kotlin
@SuppressLint("MissingPermission")
private fun getCurrentLocation() {
    fusedLocationClient.lastLocation.addOnSuccessListener { location ->
        if (location == null) {
            showMessage("No se pudo obtener la ubicación GPS")
            return@addOnSuccessListener
        }

        sendLocationToServer(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = location.accuracy.toDouble()
        )
    }
}
```

Para una ubicación más actual y precisa, se puede utilizar `getCurrentLocation` de `FusedLocationProviderClient` con un `CancellationToken`, especialmente cuando `lastLocation` devuelve `null` o una posición antigua.

## Enviar la ubicación

Ejemplo usando corrutinas:

```kotlin
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private fun sendLocationToServer(
    latitude: Double,
    longitude: Double,
    accuracy: Double
) {
    val request = LocationRequest(
        device_id = "ANDROID-001",
        node_id = selectedNodeId,
        inspection_id = currentInspectionId,
        latitude = latitude,
        longitude = longitude,
        accuracy = accuracy,
        timestamp = Instant.now().toString()
    )

    CoroutineScope(Dispatchers.IO).launch {
        try {
            val response = RetrofitProvider.api.sendLocation(request)

            withContext(Dispatchers.Main) {
                if (response.isSuccessful) {
                    showMessage("Ubicación enviada correctamente")
                } else {
                    showMessage("Error del servidor: ${response.code()}")
                }
            }
        } catch (exception: Exception) {
            withContext(Dispatchers.Main) {
                showMessage("No se pudo conectar con el servidor")
            }
        }
    }
}
```

En este ejemplo:

```kotlin
selectedNodeId = "NODE-002"
currentInspectionId = "INS-20260907-001"
```

En la aplicación real, ambos valores deben venir de la selección del técnico y del flujo de inspección.

## Selección del nodo

La aplicación Android debe consultar la red antes de mostrar la pantalla de inspección:

```text
GET /api/v1/network
```

Después debe construir una lista con:

```text
networkConfig.substation
networkConfig.nodes
```

Cada elemento debe mostrar, como mínimo:

```text
NODE-001 · Central eléctrica · La Victoria
NODE-002 · Nodo Surquillo · Surquillo
NODE-003 · Nodo San Luis · San Luis
```

Cuando el técnico seleccione uno, guardar su ID:

```kotlin
selectedNodeId = selectedNode.nodeId
```

Ese mismo ID debe enviarse en `node_id` dentro del JSON.

## Manejo de respuestas

### Respuesta correcta

El servidor devuelve HTTP `201`:

```json
{
  "ok": true,
  "location": {
    "id": "LOC-123",
    "device_id": "ANDROID-001",
    "node_id": "NODE-002",
    "inspection_id": "INS-001",
    "latitude": -12.14652,
    "longitude": -77.02281,
    "accuracy": 4,
    "timestamp": "2026-09-07T18:00:00.000Z"
  }
}
```

### Error de validación

El servidor devuelve HTTP `400` cuando falta información, las coordenadas son inválidas o el nodo no existe:

```json
{
  "error": "La ubicación requiere dispositivo, nodo, inspección, coordenadas y precisión válidas."
}
```

La aplicación debe mostrar un mensaje al técnico y permitir reintentar.

## Comunicación en tiempo real

Android no necesita Socket.IO para enviar la ubicación. El envío se hace mediante Retrofit y HTTP POST:

```text
Android -> POST /api/v1/location -> Servidor
```

El servidor emite automáticamente este evento al dashboard:

```text
technician_location
```

```text
Servidor -> technician_location -> Dashboard
```

El dashboard utiliza ese evento para mostrar:

- Marcador del técnico.
- Marcador del nodo afectado.
- Precisión GPS.
- Distancia entre el técnico y el nodo.
- Estado de inspección activa.

Socket.IO solo sería necesario en Android si en el futuro la aplicación también debe recibir eventos del servidor, como una nueva falla asignada o la cancelación de una inspección.

## Prueba con Postman o PowerShell

Antes de probar desde Android, verificar el endpoint manualmente:

```powershell
$body = @{
  device_id = "ANDROID-001"
  node_id = "NODE-001"
  inspection_id = "INS-TEST-001"
  latitude = -12.146520
  longitude = -77.022810
  accuracy = 4
  timestamp = "2026-09-07T18:00:00.000Z"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://dashboard-operativo-integral.onrender.com/api/v1/location" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

También se puede consultar la última ubicación recibida:

```text
GET https://dashboard-operativo-integral.onrender.com/api/v1/location/latest
```

## Desarrollo local

### Teléfono Android físico

No utilizar `localhost` desde el teléfono. En un dispositivo físico, `localhost` apunta al propio teléfono.

Usar la IP local de la computadora:

```text
http://192.168.1.25:3000/api/v1/location
```

La computadora y el teléfono deben estar conectados a la misma red Wi-Fi y el firewall debe permitir el puerto `3000`.

### Emulador Android

Para acceder al servidor local de la computadora desde el emulador Android, usar:

```text
http://10.0.2.2:3000/api/v1/location
```

En producción usar siempre:

```text
https://dashboard-operativo-integral.onrender.com/api/v1/location
```

## Flujo recomendado para la aplicación Android

```text
1. Abrir pantalla de inspección
          |
2. Consultar GET /api/v1/network
          |
3. Mostrar nodos configurados
          |
4. Técnico selecciona nodo afectado
          |
5. Crear inspection_id
          |
6. Solicitar permiso GPS
          |
7. Obtener latitud, longitud y precisión
          |
8. Crear LocationRequest
          |
9. Enviar POST /api/v1/location
          |
10. Mostrar confirmación al técnico
          |
11. Dashboard recibe technician_location
```

## Consideraciones actuales del servidor

La API actual no requiere autenticación. Para una primera integración académica o de prueba esto permite conectar rápidamente la aplicación Android.

Antes de utilizarla en producción convendría agregar:

- Token de autenticación para cada dispositivo.
- Validación de la identidad del técnico.
- HTTPS obligatorio, ya disponible en Render.
- Base de datos para conservar el historial.
- Registro de inspecciones.
- Control de ubicaciones repetidas.
- Fecha de expiración de una inspección activa.

Actualmente las ubicaciones se almacenan en memoria del servidor. Se conserva la última ubicación y un historial temporal mientras el proceso está activo. Si Render reinicia el servicio, esos datos se pierden.

## Resumen para el desarrollador Android

La aplicación Android debe usar:

```text
Base URL:
https://dashboard-operativo-integral.onrender.com/

Consultar nodos:
GET api/v1/network

Enviar GPS:
POST api/v1/location

Consultar última ubicación:
GET api/v1/location/latest
```

La aplicación no debe enviar datos a:

```text
/mobile
/index.html
```

Esas rutas muestran interfaces web. La comunicación de Android con el servidor se realiza mediante la API REST.
