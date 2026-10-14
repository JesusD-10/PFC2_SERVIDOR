# Modificación del Proyecto Dashboard de Monitoreo Eléctrico

## Objetivo de la modificación

Antes de implementar la integración con el dispositivo móvil y GPS, se
debe modificar la lógica actual del Dashboard.

Actualmente el sistema funciona con nodos definidos por defecto. Esto
debe cambiar para convertirlo en un sistema configurable, capaz de
trabajar con diferentes distritos y redes eléctricas.

La nueva lógica será:

**Primero se configura la red eléctrica → luego inicia el monitoreo.**

------------------------------------------------------------------------

# 1. Nueva sección inicial: Definir Nodos

Al iniciar el sistema, el usuario debe visualizar una sección principal:

# ⚡ DEFINICIÓN DE RED ELÉCTRICA

Esta sección será obligatoria antes de acceder al Dashboard.

El sistema debe solicitar:

-   Nodo de subestación base.
-   Cantidad total de nodos.
-   Ubicación exacta de cada nodo.
-   Distrito donde se encuentra cada nodo.
-   Coordenadas GPS (latitud y longitud).

Mientras esta información no sea completada, las demás secciones
permanecerán bloqueadas.

------------------------------------------------------------------------

# 2. Nodo de Subestación Base

El nodo número 1 será siempre la subestación principal.

Ejemplo:

    Nodo: 001
    Tipo: Subestación principal
    Nombre: Central eléctrica
    Distrito: Barranco
    Latitud: -12.xxxxx
    Longitud: -77.xxxxx

Este nodo será el origen de la red eléctrica.

------------------------------------------------------------------------

# 3. Definición de cantidad de nodos

El usuario deberá indicar cuántos nodos tendrá la red.

Ejemplo:

    Cantidad de nodos:
    [ 10 ]

El sistema generará la estructura:

    Nodo 001 → Subestación base
    Nodo 002 → Pendiente de configuración
    Nodo 003 → Pendiente de configuración
    Nodo 004 → Pendiente de configuración
    ...
    Nodo 010 → Pendiente de configuración

Ningún nodo tendrá ubicación hasta que sea registrado.

------------------------------------------------------------------------

# 4. Registro de ubicación de nodos

Cada nodo deberá configurarse individualmente.

Ejemplo:

## Nodo 002

    Nombre:
    Nodo Barranco Este

    Distrito:
    Barranco

    Dirección:
    Malecón de Barranco

    Latitud:
    -12.xxxxx

    Longitud:
    -77.xxxxx

Al guardar la información:

    NODE_002
    Distrito: Barranco
    Ubicación:
    Latitud / Longitud registrada
    Estado: Configurado

------------------------------------------------------------------------

# 5. Bloqueo del Dashboard hasta completar la configuración

Mientras no existan nodos configurados, el sistema solamente mostrará:

    ================================

           ⚡ DEFINIR NODOS

    Configure la cantidad y ubicación
    de nodos antes de iniciar
    el monitoreo.

           [Crear red eléctrica]

    ================================

No se mostrarán:

-   Gráficas.
-   Alertas.
-   Mapa.
-   Fallas.
-   Diagnóstico IA.

------------------------------------------------------------------------

# 6. Desactivar temporalmente Diagnóstico IA

La sección de diagnóstico del asistente IA será ocultada temporalmente.

Actualmente muestra:

-   Diagnóstico de falla.
-   Causa probable.
-   Recomendación.

Esta funcionalidad se mantendrá para una futura etapa, pero no aparecerá
hasta completar la nueva lógica del sistema.

------------------------------------------------------------------------

# 7. Nueva sección: Dispositivo Móvil

Después de configurar los nodos aparecerá una nueva sección:

# 📱 DISPOSITIVO MÓVIL

Esta sección permitirá localizar físicamente la falla mediante GPS.

Funciones:

-   Seleccionar nodo donde se detectó la falla.
-   Esperar conexión del dispositivo móvil.
-   Recibir ubicación GPS.
-   Mostrar posición del técnico.

------------------------------------------------------------------------

# 8. Flujo del dispositivo móvil

Ejemplo:

## Selección del nodo afectado

    Nodo afectado:

    [ NODE_005 ]

    Estado:

    Falla detectada

Luego:

    Dispositivo:

    MOVIL_001

    Estado:

    Esperando ubicación GPS...

    Latitud:
    --

    Longitud:
    --

    Precisión:
    --

Cuando el móvil envíe información:

    Dispositivo:

    MOVIL_001

    Estado:

    Conectado

    Latitud:
    -12.xxxxx

    Longitud:
    -77.xxxxx

    Precisión:
    4 metros

------------------------------------------------------------------------

# 9. Nueva lógica de localización de falla

El flujo será:

    Sistema detecta falla

            ↓

    Nodo afectado identificado

            ↓

    Se genera inspección

            ↓

    Técnico utiliza aplicación móvil

            ↓

    GPS obtiene ubicación

            ↓

    Ubicación enviada al servidor

            ↓

    Dashboard muestra posición del técnico

------------------------------------------------------------------------

# 10. Relación entre nodo y dispositivo móvil

El sistema debe diferenciar:

    Coordenadas del nodo
            ≠
    Coordenadas del técnico

El nodo tiene una ubicación fija:

    NODE_005

    Latitud:
    -12.xxxxx

    Longitud:
    -77.xxxxx

El móvil tendrá una ubicación variable:

    MOVIL_001

    Latitud:
    -12.xxxxx

    Longitud:
    -77.xxxxx

El Dashboard podrá calcular la distancia entre ambos puntos.

------------------------------------------------------------------------

# 11. Nueva estructura de datos

La información de nodos debe dejar de estar fija en el código.

Nueva estructura:

``` javascript
networkConfig = {

  substation: {
    id: 1,
    latitude: "",
    longitude: ""
  },

  nodes: [
    {
      id: 2,
      district: "",
      latitude: "",
      longitude: ""
    }
  ]

}
```

La red eléctrica será creada por el usuario.

------------------------------------------------------------------------

# 12. Orden final del sistema

    INICIO

    ↓

    Definir red eléctrica

    ↓

    Configurar subestación base

    ↓

    Ingresar cantidad de nodos

    ↓

    Registrar ubicación de nodos

    ↓

    Guardar configuración

    ↓

    Habilitar Dashboard

    ↓

    Monitoreo eléctrico

    ↓

    Detección de falla

    ↓

    Seleccionar nodo afectado

    ↓

    Dispositivo móvil

    ↓

    GPS del técnico

    ↓

    Ubicación exacta de inspección

    ↓

    Confirmación de falla

------------------------------------------------------------------------

# Objetivo final

Convertir el Dashboard actual en una plataforma flexible donde se pueda
configurar cualquier red eléctrica, independientemente del distrito o
cantidad de nodos, y posteriormente integrar la localización en campo
mediante una aplicación móvil con GPS.
