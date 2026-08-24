# 📱 Dashboard Operativo Integral - Guía de Instalación Local

## 🚀 Inicio Rápido

### Requisitos Previos
- **Node.js** (v14+) - [Descargar](https://nodejs.org/)
- **npm** (incluido con Node.js)

### Pasos de Instalación

#### 1. Instalar Dependencias
```bash
npm install
```

#### 2. Ejecutar el Servidor
```bash
npm start
```

#### 3. Acceder a la Aplicación
Abre tu navegador y ve a:
```
http://localhost:3000
```

---

## 📋 Estructura de la Aplicación

```
Aplicacion_web/
├── server.js              # Servidor principal (Express + Socket.io)
├── package.json           # Dependencias del proyecto
├── public/
│   ├── index.html         # Interfaz principal
│   ├── css/
│   │   └── styles.css     # Estilos
│   └── js/
│       └── main.js        # Lógica del cliente
└── INSTALACION_LOCAL.md   # Este archivo
```

---

## 🔧 Configuración

### Variables de Entorno
Puedes configurar estas variables (opcionales):

```bash
# Linux/Mac
export PORT=3000
export NODE_ENV=development

# Windows (PowerShell)
$env:PORT=3000
$env:NODE_ENV=development
```

### Puerto Personalizado
Si deseas cambiar el puerto, ejecuta:
```bash
PORT=5000 npm start
```

---

## 📡 Característica: Socket.io

La aplicación usa **Socket.io** para actualizaciones en tiempo real:
- Conexión automática al servidor
- Actualizaciones de telemetría cada 10 segundos
- Comunicación bidireccional cliente-servidor

---

## 🌐 Endpoints API

### GET `/api/v1/health`
Verifica el estado del servidor
```bash
curl http://localhost:3000/api/v1/health
```

### GET `/api/v1/metrics`
Obtiene las métricas actuales
```bash
curl http://localhost:3000/api/v1/metrics
```

### GET `/api/v1/alerts/history`
Historial de alertas
```bash
curl http://localhost:3000/api/v1/alerts/history
```

### POST `/api/v1/ai/analyze`
Análisis de eventos con IA
```bash
curl -X POST http://localhost:3000/api/v1/ai/analyze \
  -H "Content-Type: application/json" \
  -d '{"load": 95, "nodeName": "Barranco Norte"}'
```

---

## 🎯 Características Principales

### Dashboard
- **Resumen**: KPIs de operación, eficiencia y riesgo
- **Nodos**: Estado detallado de cada nodo de distribución
- **Ubicaciones**: Mapa geolocalizado con cobertura
- **Alertas**: Historial de eventos críticos
- **IA Predictiva**: Análisis y recomendaciones automáticas

### Monitoreo
- Carga de sistemas en tiempo real
- Indicadores de temperatura y humedad
- Distancia estimada de fallas
- Nivel de riesgo (BAJO, MEDIO, ALTO)

### Mapa Interactivo
- Visualización de nodos en Lima
- Círculos de cobertura por nodo
- Información emergente (popup) al hacer clic

---

## 🛠 Troubleshooting

### Puerto 3000 en uso
```bash
# Cambiar a otro puerto
PORT=3001 npm start
```

### Módulos no encontrados
```bash
# Reinstalar dependencias
rm -rf node_modules
npm install
```

### Socket.io no conecta
- Verifica que el servidor esté corriendo
- Abre la consola del navegador (F12)
- Busca errores de conexión

---

## 📊 Datos de Ejemplo

### Nodos Disponibles
- **NODE-001**: Barranco Norte (-12.1469, -77.0205)
- **NODE-002**: Barranco Sur (-12.1497, -77.0249)
- **NODE-003**: Barranco Este (-12.1472, -77.0182)

### Distritos
San Isidro, Miraflores, Barranco, Surco, San Miguel, Callao, Lince, La Molina, Lima Centro, y más.

---

## 📝 Notas de Desarrollo

- La aplicación simula datos de telemetría
- Los nodos se generan dinámicamente en cada actualización
- Las alertas se generan cuando el nivel crítico se alcanza
- El modelo de IA es simulado para demostración

---

## 🚪 Detener la Aplicación

Presiona en la terminal:
```
Ctrl + C
```

---

## 📞 Soporte

Para más información o problemas:
- Revisa los logs en la terminal
- Abre la consola del navegador (F12)
- Verifica la conexión de red

---

**Versión**: 1.0.0  
**Última actualización**: 2026-08-15  
**Autor**: JLA
