import { loadShelters } from './state.js';
import { openModal, toast } from './ui.js';

export async function openDonationManager(id = null) {
  let shelters = [];
  try {
    shelters = await loadShelters();
  } catch (error) {
    toast(error.message);
    return;
  }
  const shelter = shelters.find(item => item.id === id) || shelters[0];
  if (!shelter) {
    toast('Cadastre um abrigo para visualizar as necessidades de doação.');
    return;
  }
  const donations = shelter.donations || [];
  openModal(`
    <h3>Doações para abrigos</h3>
    <p>Necessidades vinculadas ao abrigo ativo: <strong>${escapeHtml(shelter.nome)}</strong>.</p>
    <div class="donation-list">
      ${donations.map(item => `
        <div class="donation-item">
          <span>${escapeHtml(item.item)}<br><small>${escapeHtml(item.quantidade)}</small></span>
          <strong>${escapeHtml(item.urgencia)}</strong>
        </div>
      `).join('') || '<p>Nenhuma necessidade cadastrada para este abrigo.</p>'}
    </div>
    <p class="danger-note">O cadastro de necessidades ainda não possui persistência. Os controles permanecem bloqueados para não simular um salvamento.</p>
    <label class="field"><span>Novo item</span><input disabled placeholder="Aguardando integração"></label>
    <label class="field"><span>Urgência</span><select disabled><option>Alta</option><option>Média</option><option>Baixa</option></select></label>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Fechar</button>
      <button class="btn btn-secondary" disabled>Cadastro indisponível</button>
    </div>
  `);
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}