import { loadAudit } from './state.js';
import { toast } from './ui.js';

export async function renderAudit() {
  const body = document.getElementById('hist-tbody');
  if (!body) return;
  try {
    const audit = await loadAudit();
    body.innerHTML = audit.map(item => `
      <tr>
        <td>${escapeHtml(item.hora)}</td>
        <td>${escapeHtml(item.usuario)}</td>
        <td>${escapeHtml(item.acao)}</td>
        <td>${escapeHtml(item.entidade)}</td>
        <td>${escapeHtml(item.detalhe || '-')}</td>
      </tr>
    `).join('') || '<tr><td colspan="5">Nenhum registro de auditoria.</td></tr>';
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
}

export async function exportAuditReport() {
  try {
    const audit = await loadAudit();
    const headers = ['Hora', 'Usuario', 'Acao', 'Entidade', 'Detalhes'];
    const rows = audit.map(item => [
      item.hora,
      item.usuario,
      item.acao,
      item.entidade,
      item.detalhe || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(';')).join('\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.href = url;
    link.download = 'relatorio-auditoria-hydrosys.csv';
    link.click();
    URL.revokeObjectURL(url);
    toast('Relatorio de auditoria gerado.');
  } catch (error) {
    toast(error.message);
  }
}

function csvValue(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}