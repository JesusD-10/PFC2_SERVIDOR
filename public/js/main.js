const socket = io();

const districtSelect = document.getElementById('districtSelect');
const nodeSelect = document.getElementById('nodeSelect');
const statusEl = document.getElementById('connection-status');
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
const networkForm = document.getElementById('network-form');
const nodeCountInput = document.getElementById('node-count');
const generateNodesButton = document.getElementById('generate-nodes');
const nodeConfigurationList = document.getElementById('node-configuration-list');
const nodeCountLabel = document.getElementById('node-count-label');
const networkFormMessage = document.getElementById('network-form-message');
const substationDistrictSelect = document.getElementById('substation-district');
const networkStateMessages = document.querySelectorAll('[data-network-state]');
const mobileNodeSelect = document.getElementById('mobile-node-select');
const mobileConnectionState = document.getElementById('mobile-connection-state');
const mobileLatitude = document.getElementById('mobile-latitude');
const mobileLongitude = document.getElementById('mobile-longitude');
const mobileAccuracy = document.getElementById('mobile-accuracy');
const simulateGpsButton = document.getElementById('simulate-gps');
let networkConfig = null;

const limaDistricts = [
  'Lima Metropolitana', 'San Isidro', 'Miraflores', 'Barranco', 'Surco', 'San Miguel',
  'Callao', 'Lince', 'La Molina', 'Lima Centro', 'San Juan de Lurigancho',
  'Villa El Salvador', 'Ate', 'San Borja', 'Magdalena del Mar', 'Pueblo Libre',
  'Jesús María', 'Breña', 'Rímac', 'San Juan de Miraflores', 'Chorrillos', 'Pachacamac'
];

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

function renderNodeConfigurationFields() {
  const total = Math.max(2, Math.min(100, Number(nodeCountInput?.value || 2)));
  const additionalNodes = total - 1;
  if (!nodeConfigurationList) return;

  nodeCountLabel.textContent = `${total} nodos en total`;
  nodeConfigurationList.innerHTML = Array.from({ length: additionalNodes }, (_, index) => {
    const number = index + 2;
    return `
      <article class="node-config-card">
        <h3>NODE-${String(number).padStart(3, '0')} · Pendiente de configuración</h3>
        <div class="node-config-fields">
          <label>Nombre<input name="node-${index}-name" type="text" placeholder="Nodo ${String(number).padStart(3, '0')}" required /></label>
          <label>Distrito<select name="node-${index}-district" class="node-district-select" required>${limaDistricts.map((district) => `<option value="${district}">${district}</option>`).join('')}</select></label>
          <label>Dirección<input name="node-${index}-address" type="text" placeholder="Ubicación exacta" required /></label>
          <label>Latitud<input name="node-${index}-latitude" type="number" step="any" placeholder="-12.1480" required /></label>
          <label>Longitud<input name="node-${index}-longitude" type="number" step="any" placeholder="-77.0220" required /></label>
        </div>
      </article>
    `;
  }).join('');
}

function unlockDashboard() {
  networkStateMessages.forEach((message) => message.classList.add('hidden'));
  [districtSelect, nodeSelect, nodePanelDistrictSelect, nodePanelNodeSelect, locationNodeSelect, mobileNodeSelect]
    .filter(Boolean)
    .forEach((control) => { control.disabled = false; });
}

function setNetworkUnavailable() {
  networkStateMessages.forEach((message) => message.classList.remove('hidden'));
  [districtSelect, nodeSelect, nodePanelDistrictSelect, nodePanelNodeSelect, locationNodeSelect, mobileNodeSelect]
    .filter(Boolean)
    .forEach((control) => { control.disabled = true; });
}

function populateSubstationDistricts(selectedDistrict = 'Barranco') {
  if (!substationDistrictSelect) return;
  substationDistrictSelect.innerHTML = limaDistricts
    .map((district) => `<option value="${district}" ${district === selectedDistrict ? 'selected' : ''}>${district}</option>`)
    .join('');
}

function syncNodeDistrictDefaults() {
  const selectedDistrict = substationDistrictSelect?.value || 'Barranco';
  document.querySelectorAll('.node-district-select').forEach((select) => {
    select.value = selectedDistrict;
  });
}

function updateMobileNodes(nodes) {
  if (!mobileNodeSelect) return;
  mobileNodeSelect.innerHTML = nodes.map((node) => `<option value="${node.id}">${node.name}</option>`).join('');
}

async function initializeNetworkSetup() {
  populateSubstationDistricts();
  renderNodeConfigurationFields();
  syncNodeDistrictDefaults();
  setNetworkUnavailable();

  try {
    const response = await fetch('/api/v1/network');
    const result = await response.json();
    if (result.configured) {
      networkConfig = result.networkConfig;
      unlockDashboard();
    }
  } catch (error) {
    networkFormMessage.textContent = 'No se pudo consultar la configuración guardada.';
  }
}

if (generateNodesButton) generateNodesButton.addEventListener('click', () => {
  renderNodeConfigurationFields();
  syncNodeDistrictDefaults();
});
if (nodeCountInput) nodeCountInput.addEventListener('change', () => {
  renderNodeConfigurationFields();
  syncNodeDistrictDefaults();
});
if (substationDistrictSelect) substationDistrictSelect.addEventListener('change', syncNodeDistrictDefaults);

if (networkForm) {
  networkForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    networkFormMessage.textContent = 'Guardando configuración...';
    const formData = new FormData(networkForm);
    const total = Number(formData.get('nodeCount'));
    const payload = {
      substation: {
        name: formData.get('substationName'),
        district: formData.get('substationDistrict'),
        latitude: formData.get('substationLatitude'),
        longitude: formData.get('substationLongitude')
      },
      nodes: Array.from({ length: total - 1 }, (_, index) => ({
        name: formData.get(`node-${index}-name`),
        district: formData.get(`node-${index}-district`),
        address: formData.get(`node-${index}-address`),
        latitude: formData.get(`node-${index}-latitude`),
        longitude: formData.get(`node-${index}-longitude`)
      }))
    };

    try {
      const response = await fetch('/api/v1/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la red.');
      networkConfig = result.networkConfig;
      networkFormMessage.textContent = '';
      unlockDashboard();
      const telemetryResponse = await fetch('/api/v1/metrics');
      if (telemetryResponse.ok) updateDashboard(await telemetryResponse.json());
    } catch (error) {
      networkFormMessage.textContent = error.message;
    }
  });
}

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

  if (panelId === 'movil') {
    setTimeout(() => mobileMap.invalidateSize(), 0);
  }
}

navItems.forEach((item) => {
  item.addEventListener('click', () => showPanel(item.dataset.section));
});

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
const mobileMap = L.map('mobile-map', { zoomControl: true, attributionControl: true }).fitBounds(LimaBounds);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mobileMap);
const mobileMarkersGroup = L.layerGroup().addTo(mobileMap);
let latestTechnicianLocation = null;

function calculateDistanceMeters(firstLatitude, firstLongitude, secondLatitude, secondLongitude) {
  const earthRadius = 6371000;
  const latitudeDelta = (secondLatitude - firstLatitude) * Math.PI / 180;
  const longitudeDelta = (secondLongitude - firstLongitude) * Math.PI / 180;
  const latitudeOne = firstLatitude * Math.PI / 180;
  const latitudeTwo = secondLatitude * Math.PI / 180;
  const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeOne) * Math.cos(latitudeTwo) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
}

function renderTechnicianLocation(location) {
  latestTechnicianLocation = location;
  if (!location || !mobileMarkersGroup) return;

  const nodes = window.currentTelemetryData?.geo_nodes || [];
  const node = nodes.find((item) => item.id === location.node_id);
  mobileMarkersGroup.clearLayers();

  const technicianMarker = L.circleMarker([location.latitude, location.longitude], {
    radius: 11,
    color: '#0f766e',
    fillColor: '#14b8a6',
    fillOpacity: 0.95,
    weight: 3
  }).addTo(mobileMarkersGroup);
  technicianMarker.bindPopup(`<b>${location.device_id}</b><br>Inspección activa<br>Precisión: ${Math.round(location.accuracy)} m`).openPopup();

  if (node) {
    L.circleMarker([node.lat, node.lng], {
      radius: 10,
      color: '#dc2626',
      fillColor: '#ef4444',
      fillOpacity: 0.9,
      weight: 3
    }).bindPopup(`<b>${node.id}</b><br>${node.name}<br>Técnico a ${calculateDistanceMeters(node.lat, node.lng, location.latitude, location.longitude)} m`).addTo(mobileMarkersGroup);

    mobileMap.fitBounds(L.latLngBounds([[node.lat, node.lng], [location.latitude, location.longitude]]).pad(0.35));
  } else {
    mobileMap.setView([location.latitude, location.longitude], 16);
  }

  if (mobileNodeSelect) mobileNodeSelect.value = location.node_id;
  if (mobileConnectionState) {
    mobileConnectionState.textContent = `Conectado · ${location.device_id}`;
    mobileConnectionState.className = 'mobile-state connected';
  }
  if (mobileLatitude) mobileLatitude.textContent = Number(location.latitude).toFixed(6);
  if (mobileLongitude) mobileLongitude.textContent = Number(location.longitude).toFixed(6);
  if (mobileAccuracy) mobileAccuracy.textContent = `${Math.round(location.accuracy)} metros`;
}

function resetMobileLocation() {
  if (!mobileConnectionState) return;
  mobileConnectionState.textContent = 'Esperando ubicación GPS...';
  mobileConnectionState.className = 'mobile-state waiting';
  mobileLatitude.textContent = '--';
  mobileLongitude.textContent = '--';
  mobileAccuracy.textContent = '--';
  mobileMarkersGroup.clearLayers();
  if (latestTechnicianLocation && mobileNodeSelect?.value === latestTechnicianLocation.node_id) {
    renderTechnicianLocation(latestTechnicianLocation);
  }
}

function simulateMobileGps() {
  const node = (window.currentTelemetryData?.geo_nodes || []).find((item) => item.id === mobileNodeSelect?.value);
  if (!node) return;

  const latitude = Number(node.lat) + 0.0012;
  const longitude = Number(node.lng) - 0.0008;
  const accuracy = 4;
  mobileConnectionState.textContent = 'Conectado';
  mobileConnectionState.className = 'mobile-state connected';
  mobileLatitude.textContent = latitude.toFixed(6);
  mobileLongitude.textContent = longitude.toFixed(6);
  mobileAccuracy.textContent = `${accuracy} metros`;
  mobileMarkersGroup.clearLayers();
  L.circleMarker([latitude, longitude], { radius: 10, color: '#0f766e', fillColor: '#14b8a6', fillOpacity: 0.9, weight: 3 })
    .bindPopup('<b>MOVIL_001</b><br>Posición GPS del técnico')
    .addTo(mobileMarkersGroup)
    .openPopup();
  mobileMap.setView([latitude, longitude], 16);
}

if (mobileNodeSelect) mobileNodeSelect.addEventListener('change', resetMobileLocation);
if (simulateGpsButton) simulateGpsButton.addEventListener('click', simulateMobileGps);

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
  if (!networkConfig || !Array.isArray(data?.geo_nodes) || !data.geo_nodes.length) return;
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
  updateMobileNodes(data.geo_nodes);
  if (latestTechnicianLocation) renderTechnicianLocation(latestTechnicianLocation);

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

socket.on('technician_location', (location) => {
  renderTechnicianLocation(location);
});

setConnectionStatus(true);
window.currentTelemetryData = { geo_nodes: [] };
loadAlertHistory();
initializeNetworkSetup();
