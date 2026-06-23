import { api } from './api.js';
import { getActiveAlerts, loadSensors } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderMap } from './map.js';
import { renderSensors } from './sensores.js';
import { renderAudit } from './auditoria.js';
import { openModal, closeModal, toast } from './ui.js';

export async function renderAlerts() {
  const body = document.getElementById('al-tbody');
  if (!body) return;
  try {
    const alerts = getActiveAlerts(await loadSensors());
    body.innerHTML = alerts.map(alert => `
      <tr>
        <td>${escapeHtml(alert.regiao)}</td>
        <td><span class="badge ${alert.status}">${alert.status}</span></td>
        <td>${alert.level} cm</td>
        <td>${escapeHtml(alert.sensor)}</td>
        <td>${escapeHtml(alert.origem)}</td>
        <td>-</td>
      </tr>
    `).join('') || '<tr><td colspan="6">Nenhum alerta ativo.</td></tr>';
  } catch (error) {
    body.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
  }
}

export function openPublicAlertModal() {
  openModal(`
    <h3>Solicitar alerta público</h3>
    <p>Este formulário representa uma futura solicitação para canal oficial. Não há envio direto nem registro nesta versão.</p>
    <label class="field"><span>Área afetada</span><input placeholder="Bela Vista, raio proximo ao ESP-003"></label>
    <label class="field"><span>Nível de risco</span><select><option>laranja</option><option>vermelho</option></select></label>
    <label class="field"><span>Mensagem</span><textarea rows="4" placeholder="Evite a região e acompanhe os canais oficiais."></textarea></label>
    <p class="danger-note">Este formulário ainda não envia nem registra solicitações. A confirmação ficará disponível quando o fluxo possuir persistência.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-secondary" disabled>Registro indisponível</button>
    </div>
  `);
}

export async function openManualModal() {
  let sensors = [];
  try {
    sensors = await loadSensors();
  } catch (error) {
    toast(error.message);
    return;
  }
  if (!sensors.length) {
    toast('Cadastre um sensor antes de registrar ocorrência.');
    return;
  }
  openModal(`
    <h3>Registrar ocorrência manual</h3>
    <p>A ocorrência manual coloca o ponto selecionado em status vermelho.</p>
    <label class="field"><span>Ponto monitorado</span>
      <select id="manual-sensor">
        ${sensors.map(sensor => `<option value="${sensor.id}">${escapeHtml(sensor.id)} - ${escapeHtml(sensor.nome)}</option>`).join('')}
      </select>
    </label>
    <label class="field"><span>Justificativa</span><input id="manual-reason" placeholder="Equipe confirmou transbordamento"></label>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="saveManualOccurrence()">Registrar</button>
    </div>
  `);
}

export async function saveManualOccurrence() {
  const sensorCode = document.getElementById('manual-sensor')?.value || '';
  const reason = document.getElementById('manual-reason')?.value.trim() || '';
  if (!sensorCode || !reason) {
    toast('Selecione o sensor e informe a justificativa.');
    return;
  }
  try {
    await api.createManualOccurrence({ sensor_code: sensorCode, reason });
    closeModal();
    await refreshOperationalViews();
    toast('Ocorrencia manual registrada.');
  } catch (error) {
    toast(error.message);
  }
}

async function refreshOperationalViews() {
  await Promise.allSettled([
    renderDashboard(),
    renderSensors(),
    renderAlerts(),
    renderMap(),
    renderAudit(),
  ]);
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
