import { hydrateIcons } from './icons.js';

export function toast(message) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 2800);
  setTimeout(() => el.remove(), 3200);
}

export function openModal(html) {
  const root = document.getElementById('modal');
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal-box">${html}</div>
    </div>
  `;
  hydrateIcons(root);
}

export function closeModal() {
  document.getElementById('modal').innerHTML = '';
}
