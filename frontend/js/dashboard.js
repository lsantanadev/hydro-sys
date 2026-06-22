import { uiState, getActiveAlerts, loadOperationalData, loadSensors } from './state.js';
import { renderMap } from './map.js';
import { renderSensors } from './sensores.js';
import { renderAlerts } from './alertas.js';
import { renderAudit } from './auditoria.js';
import { toast } from './ui.js';
import { hydrateIcons } from './icons.js';
import { api } from './api.js';
import { CONFIG } from './config.js';

let apiConnection = 'verificando';
let sensorPolling = null;

export async function renderDashboard() {
  const data = await loadDashboardData();
  const sensors = data.sensors;
  const shelters = data.shelters;
  const residents = data.residents;
  const alerts = getActiveAlerts(sensors);

  setText('stat-sensors', sensors.length);
  setText('stat-alerts', alerts.length);
  setText('stat-shelters', shelters.filter(s => s.st !== 'fechado').length);
  setText('stat-residents', residents.length);
  setText('kv-al', sensors.filter(s => s.st === 'vermelho').length);
  setText('kv-or', sensors.filter(s => s.st === 'laranja').length);
  setText('kv-se', sensors.filter(s => s.status === 'online').length);
  setText('kv-co', '-');
  renderPrototypeController(sensors, data.error);

  const list = document.getElementById('sensor-summary');
  if (list) {
    list.innerHTML = sensors.map(sensor => `
      <div class="side-item ${sensor.st}">
        <div class="card-top"><strong>${escapeHtml(sensor.id)}</strong><span class="badge ${sensor.st}">${sensor.st}</span></div>
        <p>${escapeHtml(sensor.nome)} - ${sensor.level} cm</p>
      </div>
    `).join('') || `<p>${escapeHtml(data.error || 'Nenhum sensor cadastrado.')}</p>`;
  }
  const emergencyList = document.getElementById('emergency-summary');
  if (emergencyList) {
    emergencyList.innerHTML = '<p>Pedidos emergenciais aguardam integração para serem registrados.</p>';
  }
}

function renderPrototypeController(sensors, error = '') {
  const root = document.getElementById('prototype-controller');
  if (!root) return;
  if (!sensors.length) {
    root.innerHTML = `<p>${escapeHtml(error || 'Cadastre um sensor para enviar leituras reais ou simuladas.')}</p>`;
    return;
  }
  const sensor = findSelectedSensor(sensors);
  const pct = Math.min(100, Math.round((sensor.level / sensor.max) * 100));
  root.innerHTML = `
    <article class="prototype-reading ${sensor.st}">
      <div class="prototype-head">
        <div>
          <span class="eyebrow">Sensor em teste</span>
          <h4>${escapeHtml(sensor.nome)}</h4>
        </div>
        <div class="prototype-badges">
          <span id="prototype-api-status" class="api-status ${apiConnection}">${connectionLabel()}</span>
          <span class="badge ${sensor.st}">${sensor.st}</span>
        </div>
      </div>
      <label class="field"><span>Sensor</span>
        <select id="prototype-sensor-select" onchange="selectPrototypeSensor(this.value)">
          ${sensors.map(item => `<option value="${item.id}" ${item.id === sensor.id ? 'selected' : ''}>${escapeHtml(item.id)} - ${escapeHtml(item.nome)}</option>`).join('')}
        </select>
      </label>
      <div class="prototype-value"><strong>${sensor.level}</strong><span>cm</span><small>Ultima leitura: ${sensor.reading}</small></div>
      <div class="meter"><span style="width:${pct}%"></span></div>
      <div class="prototype-thresholds">
        <span>Atenção ${sensor.ly} cm</span>
        <span>Risco ${sensor.ll} cm</span>
        <span>Emergência ${sensor.lr} cm</span>
      </div>
      <div class="prototype-entry">
        <label class="field"><span>Leitura simulada (cm)</span><input id="prototype-level-input" type="number" min="0" max="${sensor.max}" step="0.1" value="${sensor.level}"></label>
        <button class="btn btn-primary" type="button" onclick="applyPrototypeReading()"><span data-icon="activity"></span>Enviar leitura</button>
      </div>
      <div class="prototype-actions">
        <button class="btn btn-secondary" type="button" onclick="changePrototypeLevel(4)">Aumentar +4 cm</button>
        <button class="btn btn-ghost" type="button" onclick="changePrototypeLevel(-4)">Reduzir -4 cm</button>
        <button class="btn btn-ghost" type="button" onclick="resetPrototypeSensor()">Normalizar</button>
      </div>
    </article>
  `;
  hydrateIcons(root);
}

export function selectPrototypeSensor(sensorCode) {
  uiState.selectedSensorCode = sensorCode;
  renderDashboard();
}

export function applyPrototypeReading() {
  const reading = document.getElementById('prototype-level-input')?.value;
  sendPrototypeReading(reading, 'SIMULACAO');
}

export async function changePrototypeLevel(change) {
  try {
    const sensor = findSelectedSensor(await loadSensors());
    if (!sensor) return;
    await sendPrototypeReading(sensor.level + change, 'SIMULACAO');
  } catch (error) {
    toast(error.message);
  }
}

export function resetPrototypeSensor() {
  sendPrototypeReading(0, 'SIMULACAO');
}

export function focusPrototypeControl() {
  document.getElementById('prototype-level-input')?.focus();
}

export function simulateRise() {
  changePrototypeLevel(4);
}

export function startSensorPolling() {
  pollOperationalData();
  if (!sensorPolling) {
    sensorPolling = setInterval(pollOperationalData, CONFIG.api.pollIntervalMs);
  }
}

async function sendPrototypeReading(levelValue, source) {
  let sensor = null;
  let parsedLevel = Number(levelValue);
  try {
    sensor = findSelectedSensor(await loadSensors());
    if (!sensor || !validateReading(sensor, parsedLevel)) return;
    setApiConnection('conectando');
    await api.sendSensorReading(sensor.id, parsedLevel, source);
    setApiConnection('conectada');
    await refreshViews();
    toast(`${sensor.id}: leitura enviada para a API.`);
  } catch (error) {
    setApiConnection('desconectada');
    toast(`API indisponível: ${error.message}`);
  }
}

async function pollOperationalData() {
  try {
    await refreshViews();
    setApiConnection('conectada');
  } catch {
    setApiConnection('desconectada');
  }
}

async function refreshViews() {
  await Promise.allSettled([
    renderDashboard(),
    renderSensors(),
    renderAlerts(),
    renderMap(),
    renderAudit(),
  ]);
}

async function loadDashboardData() {
  try {
    return { ...(await loadOperationalData()), error: '' };
  } catch (error) {
    return { sensors: [], shelters: [], audit: [], residents: [], error: error.message };
  }
}

function findSelectedSensor(sensors) {
  if (!sensors.length) return null;
  const current = sensors.find(sensor => sensor.id === uiState.selectedSensorCode) || sensors[0];
  uiState.selectedSensorCode = current.id;
  return current;
}

function validateReading(sensor, parsedLevel) {
  if (!Number.isFinite(parsedLevel) || parsedLevel < 0) {
    toast('Informe um nivel valido em centimetros.');
    return false;
  }
  if (parsedLevel > sensor.max) {
    toast(`O limite exibido para ${sensor.id} e ${sensor.max} cm.`);
    return false;
  }
  return true;
}

function setApiConnection(status) {
  apiConnection = status;
  const badge = document.getElementById('prototype-api-status');
  if (!badge) return;
  badge.className = `api-status ${status}`;
  badge.textContent = connectionLabel();
}

function connectionLabel() {
  return {
    verificando: 'API verificando',
    conectando: 'API enviando',
    conectada: 'API conectada',
    desconectada: 'API desconectada',
  }[apiConnection];
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}