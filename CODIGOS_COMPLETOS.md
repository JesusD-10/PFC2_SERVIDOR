# 📄 Códigos Completos - Dashboard Operativo Integral

---

## 1️⃣ PACKAGE.JSON
```json
{
  "name": "dashboard-operativo-integral",
  "version": "1.0.0",
  "description": "Dashboard operativo con monitor en tiempo real, mapa geolocalizado y asistente IA",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "socket.io": "^4.8.1"
  }
}
```

---

## 2️⃣ SERVER.JS

```javascript
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const TELEMETRY_INTERVAL_MS = 10000;

const LIMA_DISTRICTS = [
  'San Isidro', 'Miraflores', 'Barranco', 'Surco', 'San Miguel', 'Callao',
  'Lince', 'La Molina', 'Lima Centro', 'San Juan de Lurigancho', 'Villa El Salvador',
  'Ate', 'San Borja', 'Magdalena del Mar', 'Pueblo Libre', 'Jesús María',
  'Breña', 'Rímac', 'San Juan de Miraflores', 'Chorrillos', 'Pachacamac'
];

const NODE_CATALOG = [
  {
    id: 'NODE-001',
    name: 'Barranco Norte',
    district: 'Barranco',
    lat: -12.1469,
    lng: -77.0205,
    status: 'OK',
    load_percentage: 0,
    response_time_ms: 0,
    fault_zone: 'Av. Brasil - Barranco'
  },
  {
    id: 'NODE-002',
    name: 'Barranco Sur',
    district: 'Barranco',
    lat: -12.1497,
    lng: -77.0249,
    status: 'OK',
    load_percentage: 0,
    response_time_ms: 0,
    fault_zone: 'Calle Pichincha - Barranco'
  },
  {
    id: 'NODE-003',
    name: 'Barranco Este',
    district: 'Barranco',
    lat: -12.1472,
    lng: -77.0182,
    status: 'OK',
    load_percentage: 0,
    response_time_ms: 0,
    fault_zone: 'Malecón de Barranco'
  }
];

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let latestTelemetry = null;
const alertHistory = [];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTimestamp(date = new Date()) {
  return new Date(date).toISOString();
}

function computeRiskLevel(highestLoad, criticalMode) {
  if (criticalMode || highestLoad >= 90) return 'ALTO';
  if (highestLoad >= 75) return 'MEDIO';
  return 'BAJO';
}

function simulateNodeState() {
  const faultIndex = Math.floor(Math.random() * NODE_CATALOG.length);
  const baseNodes = NODE_CATALOG.map((node, index) => {
    const shouldFail = index === faultIndex && Math.random() < 0.7;
    const load = shouldFail
      ? Math.floor(randomBetween(88, 98))
      : Math.floor(randomBetween(38, 72));
    const status = shouldFail
      ? (load >= 95 ? 'CRITICAL' : 'WARNING')
      : 'OK';

    const distanceKm = shouldFail ? Number(randomBetween(0.4, 2.0).toFixed(1)) : Number(randomBetween(0.2, 1.8).toFixed(1));
    const temperatureC = shouldFail ? Math.floor(randomBetween(58, 84)) : Math.floor(randomBetween(32, 54));
    const humidityPct = shouldFail ? Math.floor(randomBetween(62, 84)) : Math.floor(randomBetween(35, 68));
    
    const baseCurve = [
      { distance_km: 0.1, index: 1.8 },
      { distance_km: 0.4, index: 2.4 },
      { distance_km: 0.7, index: 2.8 },
      { distance_km: 1.2, index: 3.5 },
      { distance_km: 1.8, index: 4.5 },
      { distance_km: 2.0, index: 5.0 }
    ];

    const nodeBias = (index + 1) * 0.45;
    const temperatureBias = temperatureC / 35;
    const humidityBias = humidityPct / 42;
    const severityBias = shouldFail ? 1.7 : 0.72;

    const faultCurve = baseCurve.map((point, pointIndex) => {
      const distanceAmplifier = point.distance_km * (1.1 + (index * 0.18));
      const phaseShift = pointIndex * 0.22 + (index * 0.16);
      const loadContribution = (load / 90) * (shouldFail ? 1.6 : 0.9);
      const value =
        point.index * severityBias +
        distanceAmplifier +
        loadContribution +
        temperatureBias +
        humidityBias +
        nodeBias +
        phaseShift;

      return {
        ...point,
        index: Number(Math.min(5, Math.max(0, value)).toFixed(1))
      };
    });

    return {
      ...node,
      status,
      load_percentage: load,
      response_time_ms: shouldFail ? Math.floor(randomBetween(850, 1450)) : Math.floor(randomBetween(180, 420)),
      temperature_c: temperatureC,
      humidity_pct: humidityPct,
      distance_km: distanceKm,
      fault_curve: faultCurve,
      life_status: shouldFail ? (load >= 95 ? 'Crítico' : 'Degradado') : 'Operativo',
      exact_location: shouldFail
        ? `${node.fault_zone} · a ${distanceKm} km del nodo ${node.name}`
        : `${node.fault_zone} · sin anomalía detectada`
    };
  });

  return baseNodes;
}

function generateTelemetryData() {
  const nodeList = simulateNodeState();
  const highestLoad = Math.max(...nodeList.map((node) => node.load_percentage));
  const activeNode = [...nodeList].sort((a, b) => b.load_percentage - a.load_percentage)[0];
  const criticalNodes = nodeList.filter((node) => node.status !== 'OK');
  const riskLevel = criticalNodes.length > 0 ? (activeNode.status === 'CRITICAL' ? 'ALTO' : 'MEDIO') : 'BAJO';
  const totalOperations = Math.floor(1200 + randomBetween(300, 900));
  const efficiency = Number((90 + randomBetween(-12, 8)).toFixed(1));
  const activeAlertsCount = criticalNodes.length > 0 ? criticalNodes.length : 0;

  const faultNode = criticalNodes[0] || activeNode;

  const telemetry = {
    timestamp: formatTimestamp(),
    environment: NODE_ENV,
    system_status: criticalNodes.length > 0 ? (activeNode.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING') : 'NORMAL',
    metrics: {
      total_operations: totalOperations,
      efficiency_percentage: efficiency,
      active_alerts_count: activeAlertsCount,
      avg_response_time_min: Number((1.5 + randomBetween(0.4, 3.5)).toFixed(1)),
      risk_level: riskLevel
    },
    geo_nodes: nodeList,
    telemetry_stream: {
      cpu_usage: Number((45 + randomBetween(10, 48)).toFixed(1)),
      network_traffic_mbps: Math.floor(randomBetween(140, 780)),
      error_rate: Number((0.01 + randomBetween(0.01, 0.08)).toFixed(4))
    },
    predictive_model: {
      status: 'training-ready',
      horizon_minutes: 15,
      anomaly_probability: Number((0.08 + randomBetween(0.05, 0.42)).toFixed(2)),
      recommended_action: riskLevel === 'ALTO' ? 'Rebalancear carga y revisar nodos críticos' : 'Mantener observación del patrón actual'
    },
    fault_context: {
      node_id: faultNode.id,
      node_name: faultNode.name,
      district: faultNode.district,
      distance_km: faultNode.distance_km,
      exact_location: faultNode.exact_location
    }
  };

  latestTelemetry = telemetry;

  if (criticalNodes.length > 0) {
    const alert = {
      id: `ALERT-${Date.now()}`,
      timestamp: telemetry.timestamp,
      level: faultNode.status,
      message: `Falla detectada en ${faultNode.name} (${faultNode.district}) · Distancia estimada: ${Number(faultNode.distance_km || 0).toFixed(1)} km desde el nodo`,
      nodeName: faultNode.name,
      nodeId: faultNode.id,
      load: faultNode.load_percentage,
      distance_km: faultNode.distance_km,
      exact_location: faultNode.exact_location,
      risk_level: riskLevel
    };

    alertHistory.push(alert);
    if (alertHistory.length > 20) alertHistory.shift();
  }

  return telemetry;
}

app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'ok',
    environment: NODE_ENV,
    timestamp: formatTimestamp(),
    uptime_seconds: Math.floor(process.uptime()),
    service: 'dashboard-operativo-integral'
  });
});

app.get('/api/v1/metrics', (_req, res) => {
  const payload = latestTelemetry || generateTelemetryData();
  res.json(payload);
});

app.get('/api/v1/alerts/history', (_req, res) => {
  res.json(alertHistory);
});

app.post('/api/v1/ai/analyze', (req, res) => {
  const eventData = req.body?.eventData || req.body || {};
  const load = Number(eventData.load ?? eventData.load_percentage ?? 0);
  const nodeName = eventData.nodeName || eventData.name || 'Nodo operativo';
  const distanceKm = Number(eventData.distance_km ?? eventData.distance ?? 0);
  const exactLocation = eventData.exactLocation || eventData.exact_location || 'zona de servicio principal';

  const aiResponse = {
    summary: `Falla detectada en ${nodeName}. La anomalía se encuentra a ${distanceKm.toFixed(1)} km del nodo y está asociada a ${exactLocation}.`,
    probableCause: 'Se identifica una sobrecarga o ruido crítico en la zona de servicio, con presión sostenida en el nodo afectado.',
    recommendation: 'Redirija tráfico al nodo alternativo, valide la integridad física de la línea, revise registros de infraestructura y prepare una respuesta inmediata antes de que la falla escale.',
    generatedAt: formatTimestamp()
  };

  res.json(aiResponse);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Cliente conectado al dashboard');

  if (latestTelemetry) {
    socket.emit('telemetry_update', latestTelemetry);
  } else {
    const initialData = generateTelemetryData();
    socket.emit('telemetry_update', initialData);
  }

  const interval = setInterval(() => {
    const data = generateTelemetryData();
    socket.emit('telemetry_update', data);
  }, TELEMETRY_INTERVAL_MS);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Cliente desconectado del dashboard');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT} [${NODE_ENV}]`);
});
```

---

## 3️⃣ INDEX.HTML (Fragmento clave)

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard Operativo - Inteligencia Predictiva</title>
    <meta
      name="description"
      content="Dashboard profesional para monitoreo operativo, alertas y soporte predictivo con IA."
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    />
    <link rel="stylesheet" href="/css/styles.css" />
  </head>
  <body>
    <div class="dashboard-shell">
      <aside class="sidebar">
        <div class="profile-block">
          <div class="avatar">J</div>
          <div class="profile-name">JLA</div>
        </div>

        <nav class="nav-menu" aria-label="Menú principal">
          <button class="nav-item active" type="button" data-section="resumen">
            <i class="fa-solid fa-table-columns"></i> Resumen
          </button>
          <button class="nav-item" type="button" data-section="nodos">
            <i class="fa-solid fa-broadcast-tower"></i> Nodos
          </button>
          <button class="nav-item" type="button" data-section="ubicaciones">
            <i class="fa-solid fa-map-location-dot"></i> Ubicaciones
          </button>
          <button class="nav-item" type="button" data-section="alertas">
            <i class="fa-solid fa-triangle-exclamation"></i> Alertas
          </button>
          <button class="nav-item" type="button" data-section="ia">
            <i class="fa-solid fa-brain"></i> IA Predictiva
          </button>
        </nav>
      </aside>

      <main class="main-panel">
        <header class="topbar">
          <div class="brand-wrap">
            <div class="brand-icon"><i class="fa-solid fa-bolt"></i></div>
            <div class="brand-text">JLA</div>
          </div>

          <div class="topbar-status">
            <div id="connection-status" class="status-online">
              <i class="fa-solid fa-signal"></i> En línea
            </div>
            <div class="status-clock">
              <i class="fa-regular fa-clock"></i>
              <span id="last-update">Sin datos</span>
            </div>
          </div>
        </header>

        <section class="content-panel active" id="resumen">
          <section class="kpis-container">
            <article class="kpi-card">
              <div class="kpi-head"><i class="fa-solid fa-bolt"></i> Lecturas totales</div>
              <p id="kpi-ops" class="value">1.49K</p>
            </article>

            <article class="kpi-card">
              <div class="kpi-head"><i class="fa-solid fa-bolt-lightning"></i> Eficiencia operativa</div>
              <p id="kpi-eff" class="value">2.12K</p>
            </article>

            <article class="kpi-card">
              <div class="kpi-head"><i class="fa-solid fa-chart-simple"></i> Riesgo máximo</div>
              <p id="kpi-risk" class="value risk-low">72.65</p>
            </article>
          </section>

          <main class="grid-content">
            <section class="card chart-card">
              <div class="section-title">
                <h2><i class="fa-solid fa-chart-area"></i> Conectividad y riesgo de falla por distancia</h2>
              </div>
              <div class="chart-legend">
                <span><i class="dot power"></i> Índice de falla</span>
                <span><i class="dot temperature"></i> Punción crítica</span>
              </div>
              <canvas id="opsChart"></canvas>
            </section>

            <section class="card map-card">
              <div class="section-title title-with-action">
                <h2><i class="fa-solid fa-map-location-dot"></i> Geolocalización de nodos</h2>
                <button class="ghost-button" type="button">Ver detalle</button>
              </div>
              <div id="map"></div>
            </section>
          </main>
        </section>
      </main>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <script src="/js/main.js"></script>
  </body>
</html>
```

---

## 4️⃣ MAIN.JS (Fragmento clave - Socket.io)

```javascript
const socket = io();

// Elementos del DOM
const districtSelect = document.getElementById('districtSelect');
const nodeSelect = document.getElementById('nodeSelect');
const statusEl = document.getElementById('connection-status');
const lastUpdateEl = document.getElementById('last-update');

const kpiOps = document.getElementById('kpi-ops');
const kpiEff = document.getElementById('kpi-eff');
const kpiRisk = document.getElementById('kpi-risk');

// Conexión Socket.io
socket.on('connect', () => {
  setConnectionStatus(true);
});

socket.on('disconnect', () => {
  setConnectionStatus(false);
});

socket.on('telemetry_update', (data) => {
  updateDashboard(data);
  renderMap(data);
  updateChart(data);
});

function setConnectionStatus(connected) {
  if (connected) {
    statusEl.classList.remove('status-offline');
    statusEl.classList.add('status-online');
    statusEl.innerHTML = '<i class="fa-solid fa-signal"></i> En línea';
  } else {
    statusEl.classList.remove('status-online');
    statusEl.classList.add('status-offline');
    statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Desconectado';
  }
}

function updateDashboard(data) {
  const metrics = data.metrics || {};

  kpiOps.textContent = metrics.total_operations ?? 0;
  kpiEff.textContent = `${metrics.efficiency_percentage ?? 0}%`;

  updateRiskVisual(metrics.risk_level || 'BAJO');

  if (data.timestamp) {
    lastUpdateEl.textContent = new Date(data.timestamp).toLocaleString('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }
}

function updateRiskVisual(level) {
  const normalized = String(level || 'BAJO').toUpperCase();
  kpiRisk.textContent = normalized;
  kpiRisk.classList.remove('risk-low', 'risk-medium', 'risk-high');

  if (normalized === 'ALTO' || normalized === 'CRITICAL') {
    kpiRisk.classList.add('risk-high');
  } else if (normalized === 'MEDIO' || normalized === 'WARNING') {
    kpiRisk.classList.add('risk-medium');
  } else {
    kpiRisk.classList.add('risk-low');
  }
}
```

---

## 5️⃣ STYLES.CSS (Fragmento clave)

```css
:root {
  --bg-color: #06121f;
  --bg-soft: #0f172a;
  --card-bg: rgba(15, 23, 42, 0.88);
  --text-color: #e2e8f0;
  --muted-text: #94a3b8;
  --accent-color: #38bdf8;
  --accent-strong: #0ea5e9;
  --warning-color: #f59e0b;
  --danger-color: #ef4444;
  --success-color: #22c55e;
  --border-color: rgba(148, 163, 184, 0.18);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #edf1f5;
  color: #0f172a;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.dashboard-shell {
  display: flex;
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f7fb 0%, #eef3f8 100%);
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1b2b42 0%, #17273a 100%);
  color: #dfe9f7;
  padding: 22px 18px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
}

.main-panel {
  flex: 1;
  padding: 14px 28px 28px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  margin-bottom: 10px;
}

.brand-text {
  font-size: 2.2rem;
  font-weight: 800;
  letter-spacing: -0.08em;
  color: #1f2d3d;
}

.kpis-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.kpi-card {
  padding: 18px;
  border-radius: 14px;
  background: white;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.04);
}

.kpi-head {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.value {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.risk-low { color: #22c55e; }
.risk-medium { color: #f59e0b; }
.risk-high { color: #ef4444; }
```

---

## 🚀 CÓMO USAR ESTOS CÓDIGOS

1. **Copia el contenido de cada sección** en su respectivo archivo
2. **Estructura de carpetas:**
   ```
   Aplicacion_web/
   ├── server.js (código sección 2)
   ├── package.json (código sección 1)
   ├── public/
   │   ├── index.html (código sección 3)
   │   ├── js/main.js (código sección 4)
   │   └── css/styles.css (código sección 5)
   ```

3. **Instala y ejecuta:**
   ```bash
   npm install
   npm start
   ```

---

**Nota:** Los códigos mostrados son fragmentos. El archivo completo tiene más secciones en HTML, JavaScript y CSS para funcionalidad completa.
