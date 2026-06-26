import { CONFIG } from './config.js';
import { api } from './api.js';
import { uiState, loadMapSensors, loadShelters, normalizeTextKey } from './state.js';
import { icon, hydrateIcons } from './icons.js';

const MAP_SENSOR_POLL_INTERVAL_MS = 5000;

let lmap = null;
let markers = [];
let mapSensorPolling = null;
let cachedSensors = [];
let cachedShelters = [];
let cachedError = '';
let lastSensorSignature = '';

export function renderMapSession() {
  const publicBack = document.getElementById('map-public-back');
  const operatorBack = document.getElementById('map-operator-back');
  const sessionControls = document.getElementById('map-session-controls');
  const residentSettings = document.getElementById('map-resident-settings');
  const userInitialsRoot = document.getElementById('map-user-initials');
  const userNameRoot = document.getElementById('map-user-name');
  const operatorSession = operatorUser();

  if (publicBack) publicBack.hidden = Boolean(operatorSession);
  if (operatorBack) operatorBack.hidden = !operatorSession;
  if (sessionControls) sessionControls.hidden = !operatorSession;
  if (residentSettings) residentSettings.hidden = true;
  if (userInitialsRoot) userInitialsRoot.textContent = operatorSession?.initials || '';
  if (userNameRoot) userNameRoot.textContent = operatorSession?.name || '';
}

export function toggleMapMenu(force = null) {
  const menu = document.getElementById('map-actions');
  const button = document.getElementById('map-menu-toggle');
  if (!menu) return;
  const shouldOpen = force === null ? !menu.classList.contains('active') : Boolean(force);
  menu.classList.toggle('active', shouldOpen);
  if (button) button.setAttribute('aria-expanded', String(shouldOpen));
}

function operatorUser() {
  if (!api.hasAuthToken()) return null;
  try {
    const user = JSON.parse(localStorage.getItem('hydrosys_operator_user') || '{}');
    const name = user.name || user.email || 'Operador';
    return {
      name,
      initials: initials(name),
    };
  } catch {
    return {
      name: 'Operador',
      initials: 'OP',
    };
  }
}

function initials(name) {
  const parts = String(name || 'Operador').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'OP';
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function color(status) {
  const markerColors = {
    verde: '#34d399',
    amarelo: '#facc15',
    laranja: '#fb923c',
    vermelho: '#fb7185',
  };
  return markerColors[status] || markerColors.verde;
}

export function initMap() {
  startMapSensorPolling();
  if (lmap || typeof L === 'undefined') {
    renderMap();
    return;
  }
  const mapRoot = document.getElementById('lmap');
  if (mapRoot) mapRoot.innerHTML = '';
  lmap = L.map('lmap', { zoomControl: true }).setView(CONFIG.center, CONFIG.zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(lmap);
  renderMap();
}

export async function renderMap() {
  renderMapSession();
  let sensors = [];
  let shelters = [];
  let error = '';
  try {
    [sensors, shelters] = await Promise.all([loadMapSensors(), loadShelters()]);
  } catch (err) {
    error = err.message;
  }
  cachedSensors = sensors;
  cachedShelters = shelters;
  cachedError = error;
  lastSensorSignature = sensorSignature(sensors);
  renderMapLayers(cachedSensors, cachedShelters, cachedError);
}

function renderMapLayers(sensors = cachedSensors, shelters = cachedShelters, error = cachedError) {
  renderMapSession();
  renderMapSide(sensors, shelters, error);
  if (!lmap) {
    const el = document.getElementById('lmap');
    if (el) {
      el.innerHTML = '<div class="map-fallback"><section class="panel"><h3>Mapa indisponível</h3><p>O Leaflet será exibido quando a biblioteca estiver carregada.</p></section></div>';
    }
    return;
  }
  markers.forEach(marker => marker.remove());
  markers = [];
  visibleSensors(sensors).forEach(sensor => {
    const markerColor = color(sensor.st);
    const markerIcon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${markerColor};border:3px solid rgba(255,255,255,.42);box-shadow:0 0 0 8px ${markerColor}22"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    markers.push(L.marker([sensor.lat, sensor.lng], { icon: markerIcon }).addTo(lmap).bindPopup(`
      <strong>${escapeHtml(sensor.nome)}</strong><br>
      Nivel atual: ${sensor.level} cm<br>
      Status: ${escapeHtml(sensor.st)}
    `));
  });
  shelters.filter(sh => sh.st !== 'fechado').forEach(shelter => {
    const shelterIcon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;border-radius:8px;background:#111d31;border:2px solid #38bdf8;color:#38bdf8;display:grid;place-items:center">${icon('shelter')}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    markers.push(L.marker([shelter.lat, shelter.lng], { icon: shelterIcon }).addTo(lmap).bindPopup(`
      <strong>${escapeHtml(shelter.nome)}</strong><br>
      Vagas disponiveis: ${shelter.vagas}
    `));
  });
  lmap.invalidateSize();
}

function startMapSensorPolling() {
  if (mapSensorPolling) return;
  mapSensorPolling = setInterval(pollMapSensors, MAP_SENSOR_POLL_INTERVAL_MS);
}

async function pollMapSensors() {
  if (uiState.page !== 'map') return;
  try {
    const sensors = await loadMapSensors();
    const nextSignature = sensorSignature(sensors);
    if (nextSignature === lastSensorSignature) return;
    cachedSensors = sensors;
    cachedError = '';
    lastSensorSignature = nextSignature;
    renderMapLayers(cachedSensors, cachedShelters, cachedError);
  } catch (err) {
    cachedError = err.message;
    renderMapSide(cachedSensors, cachedShelters, cachedError);
  }
}

function sensorSignature(sensors = []) {
  return JSON.stringify(sensors.map(sensor => ({
    id: sensor.apiId,
    status: sensor.st,
    level: sensor.level,
    lastReading: sensor.reading,
    lat: sensor.lat,
    lng: sensor.lng,
    name: sensor.nome,
    neighborhood: sensor.bairroKey,
  })));
}

export function visibleSensors(sensors = []) {
  const bairro = normalizeTextKey(document.getElementById('fb')?.value || '');
  const status = normalizeTextKey(document.getElementById('fs')?.value || '');
  return sensors.filter(sensor => {
    if (uiState.critOnly && !['laranja', 'vermelho'].includes(sensor.st)) return false;
    if (bairro && sensor.bairroKey !== bairro) return false;
    if (status && sensor.st !== status) return false;
    return true;
  });
}

export function renderMapSide(sensors = [], shelters = [], error = '') {
  const sensorsRoot = document.getElementById('mside-pts');
  if (sensorsRoot) {
    sensorsRoot.innerHTML = visibleSensors(sensors).map(sensor => `
      <article class="side-item ${sensor.st}">
        <div class="card-top"><h4>${escapeHtml(sensor.nome)}</h4><span class="badge ${sensor.st}">${sensor.st}</span></div>
        <p>${escapeHtml(sensor.endereco)}</p>
        <small>${escapeHtml(sensor.id)} - ${sensor.level} cm</small>
      </article>
    `).join('') || `<p>${escapeHtml(error || 'Nenhum sensor neste filtro.')}</p>`;
  }
  const sheltersRoot = document.getElementById('mside-sh');
  if (sheltersRoot) {
    sheltersRoot.innerHTML = shelters.map(shelter => `
      <article class="side-item">
        <div class="card-top"><h4>${escapeHtml(shelter.nome)}</h4><span class="badge ${shelter.st === 'fechado' ? 'warning' : 'good'}">${shelter.st}</span></div>
        <p>${escapeHtml(shelter.endereco)}</p>
        <small>${shelter.vagas} vagas livres</small>
      </article>
    `).join('') || `<p>${escapeHtml(error || 'Nenhum abrigo cadastrado.')}</p>`;
  }
  hydrateIcons(document);
}

export function applyFilters() {
  renderMapLayers(cachedSensors, cachedShelters, cachedError);
}

export function toggleCrit() {
  uiState.critOnly = !uiState.critOnly;
  const button = document.getElementById('btncrit');
  button?.classList.toggle('btn-secondary', uiState.critOnly);
  button?.setAttribute('aria-pressed', String(uiState.critOnly));
  renderMapLayers(cachedSensors, cachedShelters, cachedError);
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
