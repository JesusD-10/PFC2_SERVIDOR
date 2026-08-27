const socket = io();

const districtSelect = document.getElementById('districtSelect');
const nodeSelect = document.getElementById('nodeSelect');
const statusEl = document.getElementById('connection-status');
const aiAlertBox = document.getElementById('ai-alert-box');
const aiSummary = document.getElementById('ai-summary');
const aiCause = document.getElementById('ai-cause');
const aiRecommendation = document.getElementById('ai-recommendation');
const lastUpdateEl = document.getElementById('last-update');
const predictionStatusEl = document.getElementById('prediction-status');
const selectedNodeInfoEl = document.getElementById('selected-node-info');
const navItems = document.querySelectorAll('.nav-item');
const breakdownButton = document.querySelector('.ghost-button');
const nodeListEl = document.getElementById('nodeList');
const nodePanelDistrictSelect = document.getElementById('nodePanelDistrictSelect');
const nodePanelNodeSelect = document.getElementById('nodePanelNodeSelect');
const nodeLifeStatusEl = document.getElementById('nodeLifeStatus');
const locationNodeSelect = document.getElementById('locationNodeSelect');
const alertListEl = document.getElementById('alertList');
const districtSummaryEl = document.getElementById('districtSummary');
const predictionDetailEl = document.getElementById('predictionDetail');
const panels = document.querySelectorAll('.content-panel');

const kpiOps = document.getElementById('kpi-ops');
const kpiEff = document.getElementById('kpi-eff');
const kpiRisk = document.getElementById('kpi-risk');
const kpiAlerts = document.getElementById('kpi-alerts');

const districtCenters = {
  'Lima Metropolitana': [-12.046374, -77.042793],
  Barranco: [-12.1479, -77.0218],
  'San Isidro': [-12.0986, -77.0356],
  'Miraflores': [-12.1194, -77.0281],
  'San Miguel': [-12.077, -77.0918],
  Surco: [-12.1355, -76.9727],
  Lince: [-12.0862, -77.0289],
  'La Molina': [-12.0868, -76.9572],
  Callao: [-12.0565, -77.1185],
  'Lima Centro': [-12.046374, -77.042793]
};

const LimaBounds = L.latLngBounds([
  [-11.8, -77.35],
  [-12.5, -76.7]
]);

const defaultFailureCurve = [
  { distance_km: 0.1, index: 1.8 },
  { distance_km: 0.4, index: 2.4 },
  { distance_km: 0.7, index: 2.8 },
  { distance_km: 1.2, index: 3.5 },
  { distance_km: 1.8, index: 4.5 },
  { distance_km: 2.0, index: 5.0 }
];

const ctx = document.getElementById('opsChart').getContext('2d');
const opsChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: defaultFailureCurve.map((point) => formatDistanceLabel(point.distance_km)),
    datasets: [
      {
        label: 'Índice de falla',
        data: defaultFailureCurve.map((point) => point.index),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        pointBackgroundColor: defaultFailureCurve.map((point) => {
          if (point.index >= 4.5) return '#ef4444';
          if (point.index >= 3) return '#f59e0b';
          if (point.index >= 1.5) return '#38bdf8';
          return '#22c55e';
        }),
        pointBorderColor: '#f8fafc',
        pointRadius: 6,
        pointHoverRadius: 8,
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        labels: {
          color: '#0f172a'
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Distancia del nodo (km)',
          color: '#475569'
        },
        ticks: { color: '#475569' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      },
      y: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          color: '#475569'
        },
        title: {
          display: true,
          text: 'Índice de falla (0-5)',
          color: '#475569'
        },
        grid: { color: 'rgba(148, 163, 184, 0.12)' }
      }
    }
  }
});

const map = L.map('map', {
  zoomControl: true,
  attributionControl: true
}).fitBounds(LimaBounds);

function showPanel(panelId) {
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === panelId);
  });

  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.section === panelId);
  });

  if (panelId === 'ubicaciones') {
    setTimeout(() => locationMap.invalidateSize(), 0);
  }
}

navItems.forEach((item) => {
  item.addEventListener('click', () => showPanel(item.dataset.section));
});

if (breakdownButton) {
  breakdownButton.addEventListener('click', () => {
    aiAlertBox.classList.toggle('hidden');
    breakdownButton.textContent = aiAlertBox.classList.contains('hidden') ? 'Ver detalle' : 'Ocultar detalle';
  });
}
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const markersGroup = L.layerGroup().addTo(map);
const mapNotice = document.createElement('div');
mapNotice.className = 'map-message';
mapNotice.id = 'mapMessage';
document.getElementById('map').appendChild(mapNotice);

const locationMap = L.map('locationMap', {
  zoomControl: true,
  attributionControl: true
}).fitBounds(LimaBounds);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(locationMap);

const locationMarkersGroup = L.layerGroup().addTo(locationMap);
let selectedLocationNodeId = 'NODE-001';

function renderLocationMap(data) {
  if (!locationNodeSelect) return;

  const nodes = Array.isArray(data?.geo_nodes) ? data.geo_nodes : [];
  if (!nodes.length) return;

  const node = nodes.find((item) => item.id === selectedLocationNodeId) || nodes[0];
  selectedLocationNodeId = node.id;
  locationNodeSelect.value = node.id;

  locationMarkersGroup.clearLayers();

  const colorMap = { OK: '#22c55e', WARNING: '#f59e0b', CRITICAL: '#ef4444' };
  const baseColor = colorMap[node.status] || '#38bdf8';

  const marker = L.circleMarker([node.lat, node.lng], {
    radius: 14,
    color: baseColor,
    fillColor: baseColor,
    fillOpacity: 0.9,
    weight: 3
  }).addTo(locationMarkersGroup);

  marker.bindPopup(`
    <b>${node.name}</b><br>
    Distrito: ${node.district}<br>
    Estado: ${node.status}
  `).openPopup();

  locationMap.setView([node.lat, node.lng], 15);
}

if (locationNodeSelect) {
  locationNodeSelect.addEventListener('change', () => {
    selectedLocationNodeId = locationNodeSelect.value;
    renderLocationMap(window.currentTelemetryData || { geo_nodes: [] });
  });
}

let selectedNodeId = 'NODE-001';
let lastAlertKey = null;

function getDistrictNodes(data, districtName) {
  if (!data || !Array.isArray(data.geo_nodes)) return [];
  if (districtName === 'Lima Metropolitana') return data.geo_nodes;
  return data.geo_nodes.filter((node) => node.district === districtName);
}

function updateNodeSelector(nodes) {
  const districtName = districtSelect.value;
  const filtered = districtName === 'Lima Metropolitana' ? nodes : nodes.filter((node) => node.district === districtName);

  nodeSelect.innerHTML = '';

  if (!filtered.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Sin nodos disponibles';
    nodeSelect.appendChild(option);
    nodeSelect.disabled = true;
    selectedNodeId = '';
    selectedNodeInfoEl.textContent = 'No hay nodos eléctricos disponibles en este distrito.';
    return;
  }

  filtered.forEach((node) => {
    const option = document.createElement('option');
    option.value = node.id;
    option.textContent = `${node.name} (${node.status})`;
    if (node.id === selectedNodeId || (!selectedNodeId && option.value)) {
      option.selected = true;
      selectedNodeId = node.id;
    }
    nodeSelect.appendChild(option);
  });

  nodeSelect.disabled = false;
}

function updateSelectedNodeInfo(nodeData) {
  if (!nodeData) {
    selectedNodeInfoEl.textContent = 'No hay nodos eléctricos disponibles en este distrito.';
    return;
  }

  selectedNodeInfoEl.textContent = `${nodeData.name}`;
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

function getFailureIndex(node) {
  if (!node) return 0;

  const load = Number(node.load_percentage || 0);
  const statusWeight = {
    OK: 0,
    WARNING: 3,
    CRITICAL: 5
  };

  const base = statusWeight[node.status] ?? 1;
  const loadComponent = Math.max(0, Math.min(2, (load - 50) / 25));
  const distanceComponent = Number(node.distance_km || 0) > 0 ? Math.min(2, Number(node.distance_km || 0) / 3) : 0;

  return Number(Math.min(5, base + loadComponent + distanceComponent).toFixed(1));
}

function getFailureCurve(node) {
  if (Array.isArray(node?.fault_curve) && node.fault_curve.length) {
    return node.fault_curve.map((point) => ({
      distance_km: Number(point.distance_km || 0),
      index: Number(point.index || 0)
    }));
  }

  if (!node) {
    return defaultFailureCurve.map((point) => ({ ...point, index: 0 }));
  }

  // Sin falla activa: linea plana y baja, sin picos de "puncion critica".
  const flatIndex = Math.min(1.4, getFailureIndex(node));

  return defaultFailureCurve.map((point) => ({
    distance_km: point.distance_km,
    index: Number(flatIndex.toFixed(1))
  }));
}

function formatDistanceLabel(distanceKm) {
  const distanceMeters = Number(distanceKm || 0) * 1000;
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distanceMeters)} m`;
}

function updateChart(data) {
  const districtName = districtSelect.value;
  const nodes = getDistrictNodes(data, districtName);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes[0] || { status: 'CRITICAL' };
  const curve = getFailureCurve(selectedNode || data.geo_nodes?.[0] || { status: 'CRITICAL' });

  opsChart.data.labels = curve.map((point) => formatDistanceLabel(point.distance_km));
  opsChart.data.datasets[0].data = curve.map((point) => Number(point.index || 0));
  opsChart.data.datasets[0].pointBackgroundColor = curve.map((point) => {
    const value = Number(point.index || 0);
    if (value >= 4.5) return '#ef4444';
    if (value >= 3) return '#f59e0b';
    if (value >= 1.5) return '#38bdf8';
    return '#22c55e';
  });

  opsChart.data.datasets[0].label = selectedNode ? `Índice de falla · ${selectedNode.name}` : 'Índice de falla';
  opsChart.options.plugins.legend.labels.color = '#0f172a';
  opsChart.update('none');
}

function showMapMessage(message) {
  mapNotice.textContent = message;
  mapNotice.classList.add('visible');
}

function hideMapMessage() {
  mapNotice.classList.remove('visible');
}

function renderMap(data) {
  markersGroup.clearLayers();
  const districtName = districtSelect.value;
  const visibleNodes = getDistrictNodes(data, districtName);

  if (!visibleNodes.length) {
    map.setView(districtCenters[districtName] || districtCenters['Lima Metropolitana'], 12);
    showMapMessage('No hay nodos eléctricos disponibles en este distrito.');
    return;
  }

  hideMapMessage();

  const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId) || visibleNodes[0];
  if (selectedNode) {
    selectedNodeId = selectedNode.id;
    nodeSelect.value = selectedNode.id;
    updateSelectedNodeInfo(selectedNode);
  }

  const existingNodes = visibleNodes.map((node) => {
    const colorMap = {
      OK: '#22c55e',
      WARNING: '#f59e0b',
      CRITICAL: '#ef4444'
    };

    const baseColor = colorMap[node.status] || '#38bdf8';

    const safeZone = L.circle([node.lat, node.lng], {
      radius: 2000,
      color: baseColor,
      fillColor: baseColor,
      fillOpacity: 0.08,
      weight: 1.2
    }).addTo(markersGroup);

    const marker = L.circleMarker([node.lat, node.lng], {
      radius: node.id === selectedNodeId ? 14 : 11,
      color: baseColor,
      fillColor: baseColor,
      fillOpacity: 0.9,
      weight: node.id === selectedNodeId ? 3 : 2
    }).addTo(markersGroup);

    marker.bindPopup(`
      <b>${node.name}</b><br>
      Distrito: ${node.district}<br>
      Estado: ${node.status}<br>
      Carga: ${node.load_percentage}%<br>
      Temperatura: ${node.temperature_c || 0}°C<br>
      Humedad: ${node.humidity_pct || 0}%<br>
      Rango: 2.0 km aprox.<br>
      Distancia estimada: ${node.distance_km || 0} km
    `);

    return safeZone;
  });

  if (existingNodes.length > 0) {
    const groupBounds = L.featureGroup(existingNodes).getBounds();
    map.fitBounds(groupBounds.pad(0.4));
  }
}

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

function getFilteredNodes(data, districtName) {
  if (!data || !Array.isArray(data.geo_nodes)) return [];
  if (districtName === 'Lima Metropolitana') return data.geo_nodes;
  return data.geo_nodes.filter((node) => node.district === districtName);
}

function getNodeHealthMeta(node) {
  const status = String(node?.status || 'OK').toUpperCase();
  if (status === 'CRITICAL') {
    return { label: 'Crítico', className: 'critical', detail: 'Riesgo máximo de interrupción' };
  }
  if (status === 'WARNING') {
    return { label: 'Degradado', className: 'warning', detail: 'Vulnerabilidad a fallas operativas' };
  }
  return { label: 'Operativo', className: 'ok', detail: 'Estado de vida estable' };
}

function renderNodeHealthSummary(data) {
  if (!nodeLifeStatusEl) return;

  const districtName = nodePanelDistrictSelect ? nodePanelDistrictSelect.value : 'Barranco';
  const nodes = getFilteredNodes(data, districtName);
  const selectedId = nodePanelNodeSelect && nodePanelNodeSelect.value ? nodePanelNodeSelect.value : (nodes[0]?.id || '');
  const node = nodes.find((item) => item.id === selectedId) || nodes[0];

  if (!node) {
    nodeLifeStatusEl.innerHTML = '<div class="empty-state">No hay nodos eléctricos disponibles en este distrito.</div>';
    return;
  }

  const health = getNodeHealthMeta(node);
  const lifeScore = Math.min(5, Math.max(0, getFailureIndex(node)));

  nodeLifeStatusEl.innerHTML = `
    <div class="health-summary ${health.className}">
      <div class="health-header">
        <strong>${node.name}</strong>
        <span class="chip ${health.className}">${health.label}</span>
      </div>
      <p>${health.detail}</p>
      <div class="health-metrics">
        <span>Temperatura: ${node.temperature_c || 0}°C</span>
        <span>Humedad: ${node.humidity_pct || 0}%</span>
        <span>Carga: ${node.load_percentage}%</span>
      </div>
    </div>
  `;
}

function renderNodeList(data) {
  if (!nodeListEl) return;

  const districtName = nodePanelDistrictSelect ? nodePanelDistrictSelect.value : 'Barranco';
  const nodes = getFilteredNodes(data, districtName);
  nodeListEl.innerHTML = nodes.length
    ? nodes.map((node) => {
        const health = getNodeHealthMeta(node);
        return `
          <article class="node-card ${node.status.toLowerCase()}">
            <div class="node-card-header">
              <strong>${node.name}</strong>
              <span class="chip ${health.className}">${health.label}</span>
            </div>
            <div class="node-meta">
              <span>Carga: ${node.load_percentage}%</span>
              <span>Temp.: ${node.temperature_c || 0}°C</span>
              <span>Humedad: ${node.humidity_pct || 0}%</span>
            </div>
          </article>
        `;
      }).join('')
    : '<div class="empty-state">No hay nodos eléctricos disponibles en este distrito.</div>';
}

function renderAlertList(items) {
  if (!alertListEl) return;

  const alerts = Array.isArray(items) ? items : [];
  if (!alerts.length) {
    alertListEl.innerHTML = '<div class="empty-state">No hay alertas registradas en este momento.</div>';
    return;
  }

  alertListEl.innerHTML = alerts.slice().reverse().map((alert) => `
    <article class="alert-item ${String(alert.level || 'warning').toLowerCase()}">
      <div class="alert-topline">
        <strong>${alert.nodeName || 'Nodo operativo'}</strong>
        <span class="chip ${String(alert.level || 'warning').toLowerCase()}">${alert.level || 'WARNING'}</span>
      </div>
      <p>${alert.message || 'Se detectó una anomalía en la infraestructura.'}</p>
      <small>${new Date(alert.timestamp || Date.now()).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</small>
    </article>
  `).join('');
}

function renderDistrictSummary(data) {
  if (!districtSummaryEl) return;

  const districtName = districtSelect.value;
  const nodes = getDistrictNodes(data, districtName);

  districtSummaryEl.innerHTML = nodes.length
    ? `
      <div class="district-box">
        <h3>${districtName}</h3>
        <ul>
          ${nodes.map((node) => `<li><span>${node.name}</span><strong>${node.status}</strong></li>`).join('')}
        </ul>
      </div>
    `
    : '<div class="empty-state">No hay nodos eléctricos disponibles en este distrito.</div>';
}

function renderPredictionDetail(data) {
  if (!predictionDetailEl) return;

  const prediction = data.predictive_model || {};
  const faultContext = data.fault_context || {};

  predictionDetailEl.innerHTML = `
    <div class="prediction-box">
      <div class="prediction-row">
        <span>Probabilidad de anomalía</span>
        <strong>${((prediction.anomaly_probability || 0) * 100).toFixed(0)}%</strong>
      </div>
      <div class="prediction-row">
        <span>Horizon</span>
        <strong>${prediction.horizon_minutes || 15} min</strong>
      </div>
      <div class="prediction-row">
        <span>Zona crítica</span>
        <strong>${faultContext.node_name || 'Sin nodo crítico'}</strong>
      </div>
      <div class="prediction-row">
        <span>Recomendación</span>
        <strong>${prediction.recommended_action || 'Mantener observación'}</strong>
      </div>
    </div>
  `;
}

async function loadAlertHistory() {
  try {
    const response = await fetch('/api/v1/alerts/history');
    if (!response.ok) return;
    const alerts = await response.json();
    renderAlertList(alerts);
  } catch (error) {
    console.error('No se pudo cargar el historial de alertas:', error);
  }
}

function updateDashboard(data) {
  const metrics = data.metrics || {};
  const prediction = data.predictive_model || {};

  kpiOps.textContent = metrics.total_operations ?? 0;
  kpiEff.textContent = `${metrics.efficiency_percentage ?? 0}%`;

  if (kpiAlerts) {
    kpiAlerts.textContent = metrics.active_alerts_count ?? 0;
  }

  updateRiskVisual(metrics.risk_level || data.system_status || 'BAJO');

  if (kpiAlerts) {
    if (data.system_status === 'CRITICAL') {
      kpiAlerts.classList.add('warning');
    } else {
      kpiAlerts.classList.remove('warning');
    }
  }

  if (data.timestamp) {
    lastUpdateEl.textContent = new Date(data.timestamp).toLocaleString('es-PE', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  if (prediction.status) {
    predictionStatusEl.textContent = `Probabilidad de anomalía: ${(prediction.anomaly_probability * 100).toFixed(0)}% · ${prediction.recommended_action}`;
  }

  renderNodeList(data);
  renderDistrictSummary(data);
  renderPredictionDetail(data);
  updateNodeSelector(data.geo_nodes || []);
  const currentNodes = getDistrictNodes(data, districtSelect.value);
  const selectedNode = currentNodes.find((node) => node.id === selectedNodeId) || currentNodes[0];
  if (selectedNode) {
    updateSelectedNodeInfo(selectedNode);
  }

  updateChart(data);
  renderMap(data);
  renderLocationMap(data);

  const alertNode = [...(data.geo_nodes || [])]
    .filter((node) => node.status !== 'OK')
    .sort((a, b) => {
      const order = { CRITICAL: 2, WARNING: 1, OK: 0 };
      return (order[b.status] || 0) - (order[a.status] || 0);
    })[0];

  if (alertNode) {
    const alertKey = `${alertNode.id}-${alertNode.status}`;
    if (lastAlertKey !== alertKey) {
      lastAlertKey = alertKey;
      fetchAIInterpretation({
        nodeName: alertNode.name,
        load: alertNode.load_percentage,
        status: alertNode.status,
        district: alertNode.district,
        distance_km: alertNode.distance_km,
        exactLocation: alertNode.exact_location
      });
    }
  }
}

async function fetchAIInterpretation(eventData) {
  const distanceValue = Number(eventData.distance_km ?? 0);
  const distanceText = Number.isFinite(distanceValue) ? distanceValue.toFixed(1) : '0.0';

  aiSummary.textContent = `Falla detectada en ${eventData.nodeName}. Distancia estimada: ${distanceText} km desde el nodo.`;
  aiCause.textContent = eventData.exactLocation || 'Zona operativa con comportamiento anómalo.';
  aiRecommendation.textContent = 'Se recomienda validar la zona afectada y priorizar atención inmediata para evitar propagación del evento.';
  aiAlertBox.classList.remove('hidden');

  try {
    const response = await fetch('/api/v1/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eventData })
    });

    if (!response.ok) {
      throw new Error('Error desde la API IA');
    }

    const aiResult = await response.json();
    aiSummary.textContent = aiResult.summary || `Falla detectada en ${eventData.nodeName}. Distancia estimada: ${distanceText} km desde el nodo.`;
    aiCause.textContent = aiResult.probableCause || eventData.exactLocation || 'No se pudo determinar la causa exacta.';
    aiRecommendation.textContent = aiResult.recommendation || 'Verifique el estado del nodo afectado.';
    aiAlertBox.classList.remove('hidden');
  } catch (error) {
    console.error('Error al consultar IA:', error);
  }
}

districtSelect.addEventListener('change', () => {
  if (nodePanelDistrictSelect) nodePanelDistrictSelect.value = districtSelect.value;

  const currentNodes = getDistrictNodes({ geo_nodes: window.currentTelemetryData || [] }, districtSelect.value);
  if (!currentNodes.length) {
    showMapMessage('No hay nodos eléctricos disponibles en este distrito.');
    selectedNodeId = '';
    selectedNodeInfoEl.textContent = 'No hay nodos eléctricos disponibles en este distrito.';
    return;
  }

  const firstNode = currentNodes[0];
  selectedNodeId = firstNode.id;
  nodeSelect.value = firstNode.id;
  if (nodePanelNodeSelect) nodePanelNodeSelect.value = firstNode.id;
  updateSelectedNodeInfo(firstNode);
  if (window.currentTelemetryData) {
    renderMap(window.currentTelemetryData);
    updateChart(window.currentTelemetryData);
  }
});

nodeSelect.addEventListener('change', () => {
  selectedNodeId = nodeSelect.value;
  const currentNodes = getDistrictNodes({ geo_nodes: window.currentTelemetryData || [] }, districtSelect.value);
  const node = currentNodes.find((item) => item.id === selectedNodeId);
  updateSelectedNodeInfo(node || null);
  if (nodePanelNodeSelect) nodePanelNodeSelect.value = selectedNodeId;
  if (window.currentTelemetryData) {
    renderMap(window.currentTelemetryData);
    updateChart(window.currentTelemetryData);
  }
});

if (nodePanelDistrictSelect) {
  nodePanelDistrictSelect.addEventListener('change', () => {
    districtSelect.value = nodePanelDistrictSelect.value;
    const currentNodes = getFilteredNodes(window.currentTelemetryData, nodePanelDistrictSelect.value);
    if (!currentNodes.length) {
      nodePanelNodeSelect.innerHTML = '<option value="">Sin nodos disponibles</option>';
      nodePanelNodeSelect.disabled = true;
      renderNodeHealthSummary(window.currentTelemetryData || { geo_nodes: [] });
      renderNodeList(window.currentTelemetryData || { geo_nodes: [] });
      return;
    }

    nodePanelNodeSelect.disabled = false;
    nodePanelNodeSelect.innerHTML = currentNodes.map((node) => `<option value="${node.id}">${node.name}</option>`).join('');
    nodePanelNodeSelect.value = currentNodes[0].id;
    selectedNodeId = currentNodes[0].id;
    nodeSelect.value = currentNodes[0].id;
    updateSelectedNodeInfo(currentNodes[0]);
    renderNodeHealthSummary(window.currentTelemetryData || { geo_nodes: [] });
    renderNodeList(window.currentTelemetryData || { geo_nodes: [] });
    renderMap(window.currentTelemetryData || { geo_nodes: [] });
    updateChart(window.currentTelemetryData || { geo_nodes: [] });
  });
}

if (nodePanelNodeSelect) {
  nodePanelNodeSelect.addEventListener('change', () => {
    const districtName = nodePanelDistrictSelect ? nodePanelDistrictSelect.value : districtSelect.value;
    const nodes = getFilteredNodes(window.currentTelemetryData, districtName);
    const node = nodes.find((item) => item.id === nodePanelNodeSelect.value) || nodes[0];
    if (!node) return;
    selectedNodeId = node.id;
    nodeSelect.value = node.id;
    updateSelectedNodeInfo(node);
    renderNodeHealthSummary(window.currentTelemetryData || { geo_nodes: [] });
    renderMap(window.currentTelemetryData || { geo_nodes: [] });
    updateChart(window.currentTelemetryData || { geo_nodes: [] });
  });
}

socket.on('connect', () => {
  setConnectionStatus(true);
});

socket.on('disconnect', () => {
  setConnectionStatus(false);
});

socket.on('telemetry_update', (data) => {
  window.currentTelemetryData = data;
  updateDashboard(data);
  renderDistrictSummary(data);
  renderPredictionDetail(data);
  renderNodeList(data);
  loadAlertHistory();
});

setConnectionStatus(true);
window.currentTelemetryData = { geo_nodes: [] };
loadAlertHistory();
