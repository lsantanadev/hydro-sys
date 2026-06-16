import { CONFIG } from './config.js';
import { uiState, loadSensors, loadShelters } from './state.js';
import { icon, hydrateIcons } from './icons.js';

let lmap = null;
let markers = [];

export function renderMapSession() {
  const publicBack = document.getElementById('map-public-back');
  const operatorBack = document.getElementById('map-operator-back');
  const sessionControls = document.getElementById('map-session-controls');
  const residentSettings = document.getElementById('map-resident-settings');
  const userInitialsRoot = document.getElementById('map-user-initials');
  const userNameRoot = document.getElementById('map-user-name');

  if (publicBack) publicBack.hidden = false;
  if (operatorBack) operatorBack.hidden = true;
  if (sessionControls) sessionControls.hidden = true;
  if (residentSettings) residentSettings.hidden = true;
  if (userInitialsRoot) userInitialsRoot.textContent = '';
  if (userNameRoot) userNameRoot.textContent = '';
}

function color(status) {
  return {
    verde: '#34d399',
    amarelo: '#facc15',
    laranja: '#fb923c',
    vermelho: '#fb7185',
  }[status] || '#38bdf8';
}

export function initMap() {
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
    [sensors, shelters] = await Promise.all([loadSensors(), loadShelters()]);
  } catch (err) {
    error = err.message;
  }
  renderMapSide(sensors, shelters, error);
  if (!lmap) {
    const el = document.getElementById('lmap');
    if (el) {
      el.innerHTML = '<div class="map-fallback"><section class="panel"><h3>Mapa indisponivel</h3><p>O Leaflet sera exibido quando a biblioteca estiver carregada.</p></section></div>';
    }
    return;
  }
  markers.forEach(marker => marker.remove());
  markers = [];
  visibleSensors(sensors).forEach(sensor => {
    const markerIcon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${color(sensor.st)};border:3px solid rgba(255,255,255,.42);box-shadow:0 0 0 8px ${color(sensor.st)}22"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    markers.push(L.marker([sensor.lat, sensor.lng], { icon: markerIcon }).addTo(lmap).bindPopup(`
      <strong>${escapeHtml(sensor.nome)}</strong><br>
      ${escapeHtml(sensor.endereco)}<br>
      Nivel: ${sensor.level} cm<br>
      Status: ${sensor.st}
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
      Vagas: ${Math.max(0, shelter.cap - shelter.occ)}
    `));
  });
  lmap.invalidateSize();
}

export function visibleSensors(sensors = []) {
  const bairro = document.getElementById('fb')?.value || '';
  const status = document.getElementById('fs')?.value || '';
  return sensors.filter(sensor => {
    if (uiState.critOnly && !['laranja', 'vermelho'].includes(sensor.st)) return false;
    if (bairro && sensor.bairro !== bairro) return false;
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
        <small>${Math.max(0, shelter.cap - shelter.occ)} vagas livres</small>
      </article>
    `).join('') || `<p>${escapeHtml(error || 'Nenhum abrigo cadastrado.')}</p>`;
  }
  hydrateIcons(document);
}

export function applyFilters() {
  renderMap();
}

export function toggleCrit() {
  uiState.critOnly = !uiState.critOnly;
  document.getElementById('btncrit')?.classList.toggle('btn-secondary', uiState.critOnly);
  renderMap();
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}