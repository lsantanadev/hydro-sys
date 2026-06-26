import { api } from './api.js';
import { loadSensors } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderAlerts } from './alertas.js';
import { renderMap } from './map.js';
import { renderAudit } from './auditoria.js';
import { hydrateIcons } from './icons.js';
import { openModal, closeModal, toast } from './ui.js';

export async function renderSensors() {
  const root = document.getElementById('sg-grid');
  if (!root) return;
  try {
    const sensors = await loadSensors();
    root.innerHTML = sensors.map(sensor => {
      const pct = Math.min(100, Math.round((sensor.level / sensor.max) * 100));
      return `
        <article class="sensor-card ${sensor.st}">
          <div class="card-top"><strong>${escapeHtml(sensor.id)}</strong><span class="badge ${sensor.st}">${sensor.st}</span></div>
          <h3>${escapeHtml(sensor.nome)}</h3>
          <p>${escapeHtml(sensor.endereco)}</p>
          <div class="sensor-reading-meta" aria-label="Leitura atual do sensor">
            <span><small>Nivel atual</small><strong class="reading">${sensor.level} cm</strong></span>
            <span><small>Ultima leitura</small><strong>${escapeHtml(sensor.reading)}</strong></span>
          </div>
          ${sensor.lastReadingDiscarded ? '<span class="reading-discarded">Ultima leitura descartada pelo filtro</span>' : ''}
          <div class="meter"><span style="width:${pct}%"></span></div>
          <div class="sensor-thresholds" aria-label="Limiares configurados">
            <span><small>Amarelo</small><strong>${sensor.ly} cm</strong></span>
            <span><small>Laranja</small><strong>${sensor.ll} cm</strong></span>
            <span><small>Vermelho</small><strong>${sensor.lr} cm</strong></span>
          </div>
          <small>Conexao: ${sensor.status}</small>
          <button class="btn btn-ghost full" type="button" onclick="openEditSensorModal(${sensor.apiId})"><span data-icon="settings"></span>Editar sensor</button>
        </article>
      `;
    }).join('') || '<p>Nenhum sensor cadastrado.</p>';
    hydrateIcons(root);
  } catch (error) {
    root.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

export function openSensorModal() {
  openModal(`
    <h3>Novo sensor ESP32</h3>
    <p>Cadastre o dispositivo que aparecerá no mapa público.</p>
    <form id="sensor-create-form" onsubmit="event.preventDefault(); saveSensorCreate()">
      <div class="form-grid modal-grid">
        <label class="field"><span>Código do sensor</span><input id="sensor-code" maxlength="50" placeholder="ESP-001" autocomplete="off" required></label>
        <label class="field"><span>Nome do ponto</span><input id="sensor-name" maxlength="120" placeholder="Ponte do Rio Cubatão" required></label>
        <label class="field"><span>Bairro</span><input id="sensor-neighborhood" maxlength="120" placeholder="Centro"></label>
        <label class="field span-2"><span>Descrição do local</span><input id="sensor-location" maxlength="255" placeholder="Margem do rio, ao lado da ponte"></label>
        <label class="field"><span>Latitude</span><input id="sensor-lat" type="number" min="-90" max="90" step="0.000001" placeholder="-27.645" required></label>
        <label class="field"><span>Longitude</span><input id="sensor-lng" type="number" min="-180" max="180" step="0.000001" placeholder="-48.670" required></label>
        <label class="field"><span>Limiar amarelo (cm)</span><input id="sensor-yellow" type="number" min="0.1" step="0.1" placeholder="5" required></label>
        <label class="field"><span>Limiar laranja (cm)</span><input id="sensor-orange" type="number" min="0.1" step="0.1" placeholder="10" required></label>
        <label class="field"><span>Limiar vermelho (cm)</span><input id="sensor-red" type="number" min="0.1" step="0.1" placeholder="15" required></label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
        <button id="sensor-submit" class="btn btn-primary" type="submit">Cadastrar sensor</button>
      </div>
    </form>
  `);
  document.getElementById('sensor-code')?.focus();
}

export async function saveSensorCreate() {
  const payload = readSensorForm('sensor');
  if (!payload) return;
  const submit = document.getElementById('sensor-submit');
  if (submit) submit.disabled = true;
  try {
    await api.createSensor(payload);
    closeModal();
    await refreshOperationalViews();
    toast('Sensor cadastrado no banco.');
  } catch (error) {
    toast(error.message);
    if (submit) submit.disabled = false;
  }
}

export async function openEditSensorModal(id) {
  let sensor = null;
  try {
    sensor = (await loadSensors()).find(item => item.apiId === Number(id));
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sensor) return toast('Sensor não encontrado.');
  openModal(`
    <h3>Editar sensor ${escapeHtml(sensor.id)}</h3>
    <form id="sensor-edit-form" onsubmit="event.preventDefault(); saveSensorEdit(${sensor.apiId})">
      <div class="form-grid modal-grid">
        <label class="field"><span>Nome do ponto</span><input id="edit-name" value="${escapeHtml(sensor.nome)}" required></label>
        <label class="field"><span>Bairro</span><input id="edit-neighborhood" value="${escapeHtml(sensor.bairro)}"></label>
        <label class="field span-2"><span>Descrição do local</span><input id="edit-location" value="${escapeHtml(sensor.endereco)}"></label>
        <label class="field"><span>Latitude</span><input id="edit-lat" type="number" step="0.000001" value="${sensor.lat}" required></label>
        <label class="field"><span>Longitude</span><input id="edit-lng" type="number" step="0.000001" value="${sensor.lng}" required></label>
        <label class="field"><span>Limiar amarelo (cm)</span><input id="edit-yellow" type="number" min="0.1" step="0.1" value="${sensor.ly}" required></label>
        <label class="field"><span>Limiar laranja (cm)</span><input id="edit-orange" type="number" min="0.1" step="0.1" value="${sensor.ll}" required></label>
        <label class="field"><span>Limiar vermelho (cm)</span><input id="edit-red" type="number" min="0.1" step="0.1" value="${sensor.lr}" required></label>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" type="button" onclick="closeModal()">Cancelar</button>
        <button id="sensor-delete" class="btn btn-danger" type="button" onclick="deleteSensor(${sensor.apiId}, '${escapeAttribute(sensor.id)}')">Desativar</button>
        <button id="sensor-edit-submit" class="btn btn-primary" type="submit">Salvar alteracoes</button>
      </div>
    </form>
  `);
}

export async function saveSensorEdit(id) {
  const payload = readSensorForm('edit', false);
  if (!payload) return;
  const submit = document.getElementById('sensor-edit-submit');
  if (submit) submit.disabled = true;
  try {
    await api.updateSensor(id, payload);
    closeModal();
    await refreshOperationalViews();
    toast('Sensor atualizado.');
  } catch (error) {
    toast(error.message);
    if (submit) submit.disabled = false;
  }
}

export async function deleteSensor(id, sensorCode = '') {
  const label = sensorCode || 'este sensor';
  if (!window.confirm(`Desativar ${label}? O sensor deixara de aparecer no mapa publico.`)) {
    return;
  }
  const button = document.getElementById('sensor-delete');
  if (button) button.disabled = true;
  try {
    await api.deleteSensor(id);
    closeModal();
    await refreshOperationalViews();
    toast('Sensor desativado.');
  } catch (error) {
    toast(error.message);
    if (button) button.disabled = false;
  }
}

async function refreshOperationalViews() {
  await Promise.allSettled([
    renderSensors(),
    renderDashboard(),
    renderAlerts(),
    renderMap(),
    renderAudit(),
  ]);
}

function readSensorForm(prefix, includeCode = true) {
  const threshold_yellow = numberValue(`${prefix}-yellow`);
  const threshold_orange = numberValue(`${prefix}-orange`);
  const threshold_red = numberValue(`${prefix}-red`);
  const latitude = numberValue(`${prefix}-lat`);
  const longitude = numberValue(`${prefix}-lng`);
  if (![threshold_yellow, threshold_orange, threshold_red, latitude, longitude].every(Number.isFinite)) {
    toast('Informe coordenadas e limiares numéricos.');
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    toast('Informe coordenadas válidas: latitude entre -90 e 90, longitude entre -180 e 180.');
    return null;
  }
  if ([threshold_yellow, threshold_orange, threshold_red].some(value => value <= 0)) {
    toast('Os limiares precisam ser maiores que zero.');
    return null;
  }
  if (!(threshold_yellow < threshold_orange && threshold_orange < threshold_red)) {
    toast('Use limiares crescentes: amarelo < laranja < vermelho.');
    return null;
  }
  const payload = {
    name: value(`${prefix}-name`),
    neighborhood: value(`${prefix}-neighborhood`),
    location_description: value(`${prefix}-location`),
    latitude,
    longitude,
    threshold_yellow,
    threshold_orange,
    threshold_red,
  };
  if (!payload.name) {
    toast('Informe o nome do ponto.');
    return null;
  }
  if (includeCode) {
    payload.sensor_code = value(`${prefix}-code`).toUpperCase();
    if (!payload.sensor_code) {
      toast('Informe o código do sensor.');
      return null;
    }
    if (!/^[A-Z0-9_-]+$/.test(payload.sensor_code)) {
      toast('Use apenas letras, números, hífen ou underscore no código do sensor.');
      return null;
    }
  }
  return payload;
}

function numberValue(id) {
  const rawValue = value(id);
  return rawValue === '' ? Number.NaN : Number(rawValue);
}

function value(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttribute(text) {
  return escapeHtml(text).replaceAll("'", '&#39;');
}
