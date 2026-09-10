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
const TELEMETRY_INTERVAL_MS = 180000;
let telemetrySource = process.env.TELEMETRY_SOURCE === 'gateway' ? 'gateway' : 'simulator';
const LIMA_DISTRICTS = [
  'Ancón', 'Ate', 'Barranco', 'Breña', 'Carabayllo', 'Chaclacayo', 'Chorrillos',
  'Cieneguilla', 'Comas', 'El Agustino', 'Independencia', 'Jesús María', 'La Molina',
  'La Victoria', 'Lince', 'Los Olivos', 'Lurigancho', 'Lurín', 'Magdalena del Mar',
  'Pueblo Libre', 'Miraflores', 'Pachacámac', 'Pucusana', 'Puente Piedra',
  'Punta Hermosa', 'Punta Negra', 'Rímac', 'San Bartolo', 'San Borja', 'San Isidro',
  'San Juan de Lurigancho', 'San Juan de Miraflores', 'San Luis', 'San Martín de Porres',
  'San Miguel', 'Santa Anita', 'Santa María del Mar', 'Santa Rosa', 'Santiago de Surco',
  'Surquillo', 'Villa El Salvador', 'Villa María del Triunfo', 'Callao'
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
let latestTechnicianLocation = null;
const technicianLocations = [];
let networkConfig = null;
const latestGatewayReadings = new Map();

// Estado persistente entre ciclos: evita que todos los valores se regeneren desde cero cada 10s.
let nodeStates = null;
let activeFault = null;
let faultSequenceIndex = 0;

// La falla avanza en secuencia fija: 100 m -> 200 m -> 500 m -> se repite.
const FAULT_DISTANCE_SEQUENCE_KM = [0.1, 0.2, 0.5];
const FAULT_DURATION_TICKS = 4;
// Puntos relativos a la distancia de la falla (1.0 = punto exacto de la falla) para dibujar un pico tipo reflectometría.
const FAULT_CURVE_RATIOS = [0.02, 0.15, 0.4, 0.7, 0.9, 1, 1.12, 1.35, 1.7, 2.2];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function driftValue(previous, min, max, step) {
  return Math.round(clamp(previous + randomBetween(-step, step), min, max));
}

function initNodeStates() {
  const configuredNodes = networkConfig ? [networkConfig.substation, ...networkConfig.nodes] : [];

  return configuredNodes.map((node, index) => ({
    ...node,
    id: node.nodeId || node.id || `NODE-${String(index + 1).padStart(3, '0')}`,
    name: node.name || (index === 0 ? 'Subestación principal' : `Nodo ${String(index + 1).padStart(3, '0')}`),
    district: node.district || 'Sin distrito',
    lat: Number(node.latitude ?? node.lat),
    lng: Number(node.longitude ?? node.lng),
    fault_zone: node.address || node.fault_zone || 'Ubicación configurada',
    status: 'OK',
    load_percentage: Math.floor(randomBetween(38, 55)),
    response_time_ms: Math.floor(randomBetween(180, 320)),
    temperature_c: Math.floor(randomBetween(32, 42)),
    humidity_pct: Math.floor(randomBetween(40, 55)),
    distance_km: 0,
    fault_curve: [],
    life_status: 'Operativo',
    exact_location: `${node.address || node.fault_zone || 'Ubicación configurada'} · sin anomalía detectada`
  }));
}

function getConfiguredNodes() {
  return networkConfig ? [networkConfig.substation, ...networkConfig.nodes] : [];
}

function getConfiguredNodeIds() {
  return getConfiguredNodes().map((node, index) => node.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`);
}

function buildGatewayTelemetry() {
  const configuredNodes = getConfiguredNodes();
  const nodeList = configuredNodes.map((node, index) => {
    const id = node.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`;
    const reading = latestGatewayReadings.get(id);
    const measurements = reading?.measurements || {};
    const status = reading?.status || 'NO_DATA';
    return {
      id,
      name: node.name || `Nodo ${String(index + 1).padStart(3, '0')}`,
      district: node.district || 'Sin distrito',
      lat: Number(node.latitude ?? node.lat),
      lng: Number(node.longitude ?? node.lng),
      status,
      load_percentage: Number(measurements.load_percentage || 0),
      response_time_ms: Number(measurements.response_time_ms || 0),
      temperature_c: Number(measurements.temperature_c || 0),
      humidity_pct: Number(measurements.humidity_pct || 0),
      voltage_v: Number(measurements.voltage_v || 0),
      current_a: Number(measurements.current_a || 0),
      power_kw: Number(measurements.power_kw || 0),
      energy_kwh: Number(measurements.energy_kwh || 0),
      distance_km: Number(reading?.distance_km || 0),
      fault_curve: Array.isArray(reading?.fault_curve) ? reading.fault_curve : [],
      life_status: status === 'CRITICAL' ? 'Crítico' : status === 'WARNING' ? 'Degradado' : status === 'OK' ? 'Operativo' : 'Sin datos',
      exact_location: node.address || node.fault_zone || 'Ubicación configurada',
      gateway_id: reading?.gateway_id || null,
      reading_timestamp: reading?.timestamp || null
    };
  });
  const activeNodes = nodeList.filter((node) => ['WARNING', 'CRITICAL'].includes(node.status));
  const faultNode = activeNodes[0] || nodeList[0];
  const hasReadings = nodeList.some((node) => node.gateway_id);
  const highestLoad = Math.max(0, ...nodeList.map((node) => node.load_percentage));
  const riskLevel = activeNodes.some((node) => node.status === 'CRITICAL') ? 'ALTO' : activeNodes.length ? 'MEDIO' : 'BAJO';

  return {
    timestamp: faultNode?.reading_timestamp || formatTimestamp(),
    environment: NODE_ENV,
    telemetry_source: 'gateway',
    system_status: !hasReadings ? 'WAITING_GATEWAY' : activeNodes.some((node) => node.status === 'CRITICAL') ? 'CRITICAL' : activeNodes.length ? 'WARNING' : 'NORMAL',
    metrics: {
      total_operations: nodeList.reduce((total, node) => total + Number(node.energy_kwh || 0), 0),
      efficiency_percentage: highestLoad ? Number(Math.max(0, 100 - highestLoad / 2).toFixed(1)) : 0,
      active_alerts_count: activeNodes.length,
      avg_response_time_min: Number((nodeList.reduce((total, node) => total + node.response_time_ms, 0) / Math.max(1, nodeList.length) / 60000).toFixed(1)),
      risk_level: riskLevel
    },
    geo_nodes: nodeList,
    telemetry_stream: { cpu_usage: 0, network_traffic_mbps: 0, error_rate: 0 },
    predictive_model: { status: hasReadings ? 'gateway-data' : 'waiting', horizon_minutes: 0, anomaly_probability: 0, recommended_action: hasReadings ? 'Análisis basado en lecturas del gateway' : 'Esperando lecturas del gateway' },
    fault_context: faultNode ? { node_id: faultNode.id, node_name: faultNode.name, district: faultNode.district, distance_km: faultNode.distance_km, exact_location: faultNode.exact_location } : {}
  };
}

function pickNextFaultNode(previousNodeId) {
  const candidates = (nodeStates || []).filter((node) => node.id !== previousNodeId);
  const pool = candidates.length ? candidates : (nodeStates || []);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Simula un pico de reflectometría: sube hasta la distancia de la falla y decae con pequeñas oscilaciones después.
function buildFaultCurve(distanceKm, severity) {
  const peakHeight = severity === 'CRITICAL' ? 5 : 3.8;

  return FAULT_CURVE_RATIOS.map((ratio) => {
    const distanceFromPeak = ratio - 1;
    const decay = Math.exp(-Math.pow(distanceFromPeak * (distanceFromPeak < 0 ? 2.4 : 1.6), 2));
    const ripple = ratio > 1 ? Math.abs(Math.sin(ratio * 5)) * 0.35 : 0;
    const noise = randomBetween(-0.08, 0.08);
    const value = 0.5 + (peakHeight - 0.5) * decay + ripple + noise;

    return {
      distance_km: Number((distanceKm * ratio).toFixed(3)),
      index: Number(clamp(value, 0, 5).toFixed(1))
    };
  });
}

function simulateNodeState() {
  if (!networkConfig || !networkConfig.nodes.length) return [];

  if (!nodeStates) {
    nodeStates = initNodeStates();
  }

  if (!activeFault || activeFault.ticksRemaining <= 0) {
    const faultNodeCatalog = pickNextFaultNode(activeFault?.nodeId || null);
    const distanceKm = FAULT_DISTANCE_SEQUENCE_KM[faultSequenceIndex % FAULT_DISTANCE_SEQUENCE_KM.length];
    faultSequenceIndex += 1;

    activeFault = {
      nodeId: faultNodeCatalog.id,
      distanceKm,
      severity: Math.random() < 0.45 ? 'CRITICAL' : 'WARNING',
      ticksRemaining: FAULT_DURATION_TICKS,
      isNew: true
    };
  } else {
    activeFault = { ...activeFault, isNew: false, ticksRemaining: activeFault.ticksRemaining - 1 };
  }

  nodeStates = nodeStates.map((node) => {
    if (node.id === activeFault.nodeId) {
      const load = activeFault.severity === 'CRITICAL'
        ? driftValue(node.load_percentage || 90, 90, 99, 2)
        : driftValue(node.load_percentage || 80, 78, 92, 2);

      return {
        ...node,
        status: activeFault.severity,
        load_percentage: load,
        response_time_ms: Math.floor(randomBetween(850, 1450)),
        temperature_c: driftValue(node.temperature_c || 65, 58, 86, 2),
        humidity_pct: driftValue(node.humidity_pct || 68, 60, 85, 2),
        distance_km: activeFault.distanceKm,
        fault_curve: buildFaultCurve(activeFault.distanceKm, activeFault.severity),
        life_status: activeFault.severity === 'CRITICAL' ? 'Crítico' : 'Degradado',
        exact_location: `${node.fault_zone} · a ${Math.round(activeFault.distanceKm * 1000)} m del nodo ${node.name}`
      };
    }

    return {
      ...node,
      status: 'OK',
      load_percentage: driftValue(node.load_percentage || 45, 35, 60, 3),
      response_time_ms: Math.floor(randomBetween(180, 420)),
      temperature_c: driftValue(node.temperature_c || 36, 30, 46, 2),
      humidity_pct: driftValue(node.humidity_pct || 48, 38, 60, 2),
      distance_km: 0,
      fault_curve: [],
      life_status: 'Operativo',
      exact_location: `${node.fault_zone} · sin anomalía detectada`
    };
  });

  return nodeStates;
}

function generateTelemetryData() {
  const nodeList = simulateNodeState();
  if (!nodeList.length) {
    const emptyTelemetry = {
      timestamp: formatTimestamp(),
      environment: NODE_ENV,
      system_status: 'NOT_CONFIGURED',
      metrics: { total_operations: 0, efficiency_percentage: 0, active_alerts_count: 0, avg_response_time_min: 0, risk_level: 'BAJO' },
      geo_nodes: [],
      telemetry_stream: { cpu_usage: 0, network_traffic_mbps: 0, error_rate: 0 },
      predictive_model: { status: 'disabled', horizon_minutes: 0, anomaly_probability: 0, recommended_action: 'Configure la red eléctrica para iniciar el monitoreo' },
      fault_context: {}
    };
    latestTelemetry = emptyTelemetry;
    return emptyTelemetry;
  }

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

  // Solo se registra una alerta nueva cuando comienza una falla, no en cada ciclo mientras persiste.
  if (criticalNodes.length > 0 && activeFault?.isNew) {
    const distanceMeters = Math.round(Number(faultNode.distance_km || 0) * 1000);
    const alert = {
      id: `ALERT-${Date.now()}`,
      timestamp: telemetry.timestamp,
      level: faultNode.status,
      message: `Falla detectada en ${faultNode.name} (${faultNode.district}) · Distancia estimada: ${distanceMeters} m desde el nodo`,
      nodeName: faultNode.name,
      nodeId: faultNode.id,
      load: faultNode.load_percentage,
      distance_km: faultNode.distance_km,
      exact_location: faultNode.exact_location,
      risk_level: riskLevel
    };

    alertHistory.push(alert);
    if (alertHistory.length > 50) alertHistory.shift();
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

app.get('/api/v1/network', (_req, res) => {
  res.json({ configured: Boolean(networkConfig), networkConfig });
});

app.get('/api/v1/telemetry-mode', (_req, res) => {
  res.json({ source: telemetrySource, gateway_readings: latestGatewayReadings.size });
});

app.post('/api/v1/telemetry-mode', (req, res) => {
  const source = String(req.body?.source || '').toLowerCase();
  if (!['simulator', 'gateway'].includes(source)) {
    return res.status(400).json({ error: 'La fuente debe ser simulator o gateway.' });
  }

  telemetrySource = source;
  latestTelemetry = source === 'gateway' ? buildGatewayTelemetry() : null;
  if (source === 'simulator') {
    nodeStates = null;
    activeFault = null;
    faultSequenceIndex = 0;
  }
  io.emit('telemetry_mode', { source: telemetrySource, gateway_readings: latestGatewayReadings.size });
  if (latestTelemetry) io.emit('telemetry_update', latestTelemetry);
  return res.json({ source: telemetrySource, gateway_readings: latestGatewayReadings.size });
});

app.post('/api/v1/gateway/telemetry', (req, res) => {
  const payload = req.body || {};
  const nodeId = String(payload.node_id || '');
  const gatewayId = String(payload.gateway_id || '');
  const status = String(payload.status || 'OK').toUpperCase();
  const measurements = payload.measurements || {};

  if (!gatewayId || !getConfiguredNodeIds().includes(nodeId)) {
    return res.status(400).json({ error: 'El gateway y el nodo deben estar registrados en la red.' });
  }
  if (!['OK', 'WARNING', 'CRITICAL'].includes(status)) {
    return res.status(400).json({ error: 'El estado debe ser OK, WARNING o CRITICAL.' });
  }

  const reading = {
    gateway_id: gatewayId,
    node_id: nodeId,
    timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : formatTimestamp(),
    status,
    measurements: Object.fromEntries(Object.entries(measurements).map(([key, value]) => [key, Number(value) || 0])),
    distance_km: Number(payload.distance_km || 0),
    fault_curve: Array.isArray(payload.fault_curve) ? payload.fault_curve : [],
    alarm: payload.alarm || null
  };

  const previousReading = latestGatewayReadings.get(nodeId);
  latestGatewayReadings.set(nodeId, reading);
  if (['WARNING', 'CRITICAL'].includes(status) && previousReading?.status !== status) {
    const node = getConfiguredNodes().find((item, index) => (item.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`) === nodeId);
    alertHistory.push({
      id: `ALERT-${Date.now()}`,
      timestamp: reading.timestamp,
      level: status,
      message: reading.alarm?.message || `Falla reportada por ${gatewayId} en ${node?.name || nodeId}`,
      nodeName: node?.name || nodeId,
      nodeId,
      load: reading.measurements.load_percentage || 0,
      distance_km: reading.distance_km,
      exact_location: node?.address || 'Ubicación configurada',
      risk_level: status === 'CRITICAL' ? 'ALTO' : 'MEDIO'
    });
    if (alertHistory.length > 50) alertHistory.shift();
  }
  if (telemetrySource === 'gateway') {
    latestTelemetry = buildGatewayTelemetry();
    io.emit('telemetry_update', latestTelemetry);
  }
  return res.status(202).json({ ok: true, source: telemetrySource, reading });
});

app.post('/api/v1/network', (req, res) => {
  const candidate = req.body?.networkConfig || req.body;
  const substation = candidate?.substation;
  const nodes = Array.isArray(candidate?.nodes) ? candidate.nodes : [];

  if (!substation || !substation.latitude || !substation.longitude || !substation.district || !nodes.length || nodes.some((node) => !node.district || !node.latitude || !node.longitude)) {
    return res.status(400).json({ error: 'La subestación y todos los nodos deben tener distrito y coordenadas.' });
  }

  networkConfig = {
    substation: {
      ...substation,
      id: 1,
      nodeId: 'NODE-001',
      name: substation.name || 'Subestación principal'
    },
    nodes: nodes.map((node, index) => ({
      ...node,
      id: index + 2,
      nodeId: `NODE-${String(index + 2).padStart(3, '0')}`,
      name: node.name || `Nodo ${String(index + 2).padStart(3, '0')}`
    }))
  };
  nodeStates = null;
  activeFault = null;
  faultSequenceIndex = 0;
  latestTelemetry = null;

  return res.status(201).json({ configured: true, networkConfig });
});

app.get('/api/v1/metrics', (_req, res) => {
  const payload = latestTelemetry || (telemetrySource === 'gateway' ? buildGatewayTelemetry() : generateTelemetryData());
  res.json(payload);
});

app.get('/api/v1/alerts/history', (_req, res) => {
  res.json(alertHistory);
});

app.get('/api/v1/location/latest', (_req, res) => {
  res.json(latestTechnicianLocation || { location: null });
});

app.post('/api/v1/location', (req, res) => {
  const payload = req.body || {};
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const accuracy = Number(payload.accuracy);
  const configuredNodeIds = networkConfig ? [networkConfig.substation, ...networkConfig.nodes].map((node, index) => node.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`) : [];

  if (!payload.device_id || !payload.node_id || !payload.inspection_id || (configuredNodeIds.length > 0 && !configuredNodeIds.includes(String(payload.node_id))) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy < 0 || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'La ubicación requiere dispositivo, nodo, inspección, coordenadas y precisión válidas.' });
  }

  const location = {
    id: `LOC-${Date.now()}`,
    device_id: String(payload.device_id),
    node_id: String(payload.node_id),
    inspection_id: String(payload.inspection_id),
    latitude,
    longitude,
    accuracy,
    timestamp: payload.timestamp ? new Date(payload.timestamp).toISOString() : formatTimestamp()
  };

  latestTechnicianLocation = location;
  technicianLocations.push(location);
  if (technicianLocations.length > 100) technicianLocations.shift();
  io.emit('technician_location', location);

  return res.status(201).json({ ok: true, location });
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

app.get('/mobile', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.on('connection', (socket) => {
  console.log('Cliente conectado al dashboard');

  if (latestTelemetry) {
    socket.emit('telemetry_update', latestTelemetry);
  } else {
    const initialData = telemetrySource === 'gateway' ? buildGatewayTelemetry() : generateTelemetryData();
    socket.emit('telemetry_update', initialData);
  }

  if (latestTechnicianLocation) {
    socket.emit('technician_location', latestTechnicianLocation);
  }

  const interval = setInterval(() => {
    if (telemetrySource === 'simulator') {
      const data = generateTelemetryData();
      socket.emit('telemetry_update', data);
    }
  }, TELEMETRY_INTERVAL_MS);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Cliente desconectado del dashboard');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor ejecutándose en http://${HOST}:${PORT} [${NODE_ENV}]`);
});
