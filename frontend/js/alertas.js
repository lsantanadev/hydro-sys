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
    <h3>Solicitar alerta publico</h3>
    <p>Este formulario representa uma futura solicitacao para canal oficial. Nao ha envio direto nem registro nesta versao.</p>
    <label class="field"><span>Area afetada</span><input placeholder="Bela Vista, raio proximo ao ESP-003"></label>
    <label class="field"><span>Nivel de risco</span><select><option>laranja</option><option>vermelho</option></select></label>
    <label class="field"><span>Mensagem</span><textarea rows="4" placeholder="Evite a regiao e acompanhe os canais oficiais."></textarea></label>
    <p class="danger-note">Este formulario ainda nao envia nem registra solicitacoes. A confirmacao ficara disponivel quando o fluxo possuir persistencia.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-secondary" disabled>Registro indisponivel</button>
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
    toast('Cadastre um sensor antes de registrar ocorrencia.');
    return;
  }
  openModal(`
    <h3>Registrar ocorrencia manual</h3>
    <p>A ocorrencia manual coloca o ponto selecionado em status vermelho.</p>
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
    await api.createManualOccurrence({ sensor_code: sensorCode, reason, actor: 'operador' });
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