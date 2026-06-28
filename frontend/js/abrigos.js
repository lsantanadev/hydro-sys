import { loadShelters } from './state.js';
import { openDonationManager } from './doacoes.js';

export async function renderShelters() {
  const root = document.getElementById('sh-grid');
  if (!root) return;
  try {
    const shelters = await loadShelters();
    root.innerHTML = shelters.map(shelter => {
      const pct = shelter.cap ? Math.round((shelter.occ / shelter.cap) * 100) : 0;
      const badgeClass = shelter.st === 'lotado' ? 'warning' : 'good';
      return `
        <article class="shelter-card">
          <div class="card-top"><strong>${escapeHtml(shelter.nome)}</strong><span class="badge ${badgeClass}">${shelter.st}</span></div>
          <p>${escapeHtml(shelter.endereco)}</p>
          <div class="meter"><span style="width:${pct}%"></span></div>
          <small>${shelter.occ}/${shelter.cap} ocupacao - ${Math.max(0, shelter.cap - shelter.occ)} vagas livres</small>
          <div class="donation-list">
            ${(shelter.donations || []).map(item => `
              <div class="donation-item"><span>${escapeHtml(item.item)}</span><strong>${escapeHtml(item.urgencia)}</strong></div>
            `).join('') || '<small>Nenhuma doação cadastrada.</small>'}
          </div>
          <button class="btn btn-secondary full" onclick="openDonationManager(${shelter.id})">Gerenciar doações</button>
        </article>
      `;
    }).join('') || '<p>Nenhum abrigo cadastrado.</p>';
  } catch (error) {
    root.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export { openDonationManager };
