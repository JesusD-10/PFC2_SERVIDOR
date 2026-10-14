# Configuraciones de ubicaciones

En **Ubicaciones**, ingrese un nombre y complete la subestación y los nodos. El botón **Guardar y usar configuración** conserva una nueva configuración y la activa. Para guardar una variante, use otro nombre; los nombres repetidos se rechazan sin sobrescribir datos.

El selector **Configuraciones guardadas** permite elegir una red y cargarla. La última red activa se restaura automáticamente al abrir la aplicación y al reiniciar el servidor. Cambiar de red limpia la telemetría, alertas y ubicación del técnico de la sesión anterior para evitar asociarlas a los nuevos nodos.

Los datos se escriben de forma atómica en `data/network-configurations.json`, excluido de Git. Puede establecer `NETWORK_STORE_PATH` para usar otra ubicación. Esta persistencia requiere un disco que conserve el archivo: en un despliegue con almacenamiento efímero, como el servicio gratuito indicado en `render.yaml`, se necesita almacenamiento persistente o una base de datos para conservar las configuraciones cuando se reemplaza el servidor. No se ha modificado el despliegue remoto.

API nueva:

- `GET /api/v1/network/configurations`: lista de nombres, IDs y cantidad de nodos.
- `POST /api/v1/network/configurations`: `{ name, networkConfig }` guarda y activa.
- `POST /api/v1/network/configurations/:id/load`: activa la configuración seleccionada.

Verificación local: `node tmp/test-network-configurations.cjs` usa el puerto 3101 y un archivo de prueba aislado; valida guardado, coordenadas, nombres repetidos, carga y recuperación después de reiniciar.
