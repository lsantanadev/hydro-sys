import { loadAudit } from './state.js';
import { toast } from './ui.js';

const AUDIT_TABLE_LIMIT = 50;
let currentAuditPage = 1;

export async function renderAudit() {
  const body = document.getElementById('hist-tbody');
  if (!body) return;
  try {
    const audit = await loadAudit();
    const totalPages = Math.max(1, Math.ceil(audit.length / AUDIT_TABLE_LIMIT));
    currentAuditPage = Math.min(currentAuditPage, totalPages);
    const start = (currentAuditPage - 1) * AUDIT_TABLE_LIMIT;
    const visibleAudit = audit.slice(start, start + AUDIT_TABLE_LIMIT);
    const pageRow = audit.length > AUDIT_TABLE_LIMIT
      ? `<tr><td colspan="5">Página ${currentAuditPage} de ${totalPages} - exibindo ${visibleAudit.length} de ${audit.length} registros carregados.</td></tr>`
      : '';
    body.innerHTML = visibleAudit.map(item => `
      <tr>
        <td>${escapeHtml(item.hora)}</td>
        <td>${escapeHtml(item.usuario)}</td>
        <td>${escapeHtml(item.acao)}</td>
        <td>${escapeHtml(item.entidade)}</td>
        <td>${escapeHtml(item.detalhe || '-')}</td>
      </tr>
    `).join('') + pageRow || '<tr><td colspan="5">Nenhum registro de auditoria.</td></tr>';
    renderAuditPagination(totalPages);
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
    renderAuditPagination(0);
  }
}

export function goToAuditPage(page) {
  currentAuditPage = Math.max(1, Number(page) || 1);
  renderAudit();
}

export async function exportAuditReport() {
  try {
    const audit = await loadAudit();
    const headers = ['Data e hora', 'Ator', 'Ação', 'Entidade', 'Detalhes'];
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
    toast('Relatório de auditoria gerado.');
  } catch (error) {
    toast(error.message);
  }
}

function csvValue(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function renderAuditPagination(totalPages) {
  const root = document.getElementById('audit-pagination');
  if (!root) return;
  if (totalPages <= 1) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return `
      <button
        class="page-button ${page === currentAuditPage ? 'active' : ''}"
        type="button"
        onclick="goToAuditPage(${page})"
        aria-label="Ir para pagina ${page}"
        aria-current="${page === currentAuditPage ? 'page' : 'false'}"
      >${page}</button>
    `;
  }).join('');
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
