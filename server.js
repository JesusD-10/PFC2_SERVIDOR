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
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const TELEMETRY_INTERVAL_MS = 10000;
const LIMA_DISTRICTS = [
  'San Isidro',
  'Miraflores',
  'Barranco',
  'Surco',
  'San Miguel',
  'Callao',
  'Lince',
  'La Molina',
  'Lima Centro',
  'San Juan de Lurigancho',
  'Villa El Salvador',
  'Ate',
    'San Borja',
    'Magdalena del Mar',
    'Pueblo Libre',
    'Jesús María',
    'Breña',
    'Rímac',
    'San Juan de Miraflores',
    'Chorrillos',
    'Pachacamac'
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

function safeNodeName(nodeList, targetLoad) {
  return nodeList.find((node) => node.load_percentage === targetLoad)?.name ?? 'Nodo principal';
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

server.listen(PORT, HOST, () => {
  console.log(`Servidor ejecutándose en http://${HOST}:${PORT} [${NODE_ENV}]`);
});
