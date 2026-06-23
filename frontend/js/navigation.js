import { uiState } from './state.js';
import { renderDashboard } from './dashboard.js';
import { renderAlerts } from './alertas.js';
import { renderSensors } from './sensores.js';
import { renderShelters } from './abrigos.js';
import { renderEmergencyRequests } from './emergencia.js';
import { renderMoradores } from './auth.js';
import { renderAudit } from './auditoria.js';
import { initMap, renderMap } from './map.js';
import { api } from './api.js';
import { toast } from './ui.js';

const tabs = ['dashboard', 'alertas', 'emergencias', 'sensores', 'abrigos', 'moradores', 'auditoria'];

const routeByPage = {
  landing: 'inicio',
  map: 'mapa',
  cadastro: 'cadastro',
  login: 'login',
  admin: 'painel',
};

const pageByRoute = {
  inicio: 'landing',
  mapa: 'map',
  map: 'map',
  cadastro: 'cadastro',
  login: 'login',
  painel: 'admin',
  admin: 'admin',
};

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  return pageByRoute[route] || 'landing';
}

function updateHash(page, replace = false) {
  const route = routeByPage[page] || routeByPage.landing;
  const nextHash = `#${route}`;
  if (window.location.hash === nextHash) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method](null, '', nextHash);
}

function syncRouteFromHash() {
  goTo(routeFromHash(), { updateHash: false });
}

export function initNavigation() {
  if (!window.location.hash) {
    updateHash('landing', true);
  }
  syncRouteFromHash();
  window.addEventListener('hashchange', syncRouteFromHash);
  window.addEventListener('popstate', syncRouteFromHash);
}

export function goTo(page, options = {}) {
  let redirectedToLogin = false;
  if (page === 'admin' && !api.hasAuthToken()) {
    toast('Entre como operador para acessar o painel.');
    page = 'login';
    redirectedToLogin = true;
  }
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`pg-${page}`)?.classList.add('active');
  uiState.page = page;
  document.getElementById('topnav')?.classList.remove('active');
  if (page === 'map') {
    initMap();
    setTimeout(renderMap, 80);
  }
  if (page === 'admin') {
    showTab(uiState.adminTab);
  }
  if (options.updateHash !== false || redirectedToLogin) {
    updateHash(page, Boolean(options.replaceHash || redirectedToLogin));
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function showTab(tab) {
  uiState.adminTab = tabs.includes(tab) ? tab : 'dashboard';
  tabs.forEach(item => {
    document.getElementById(`tab-${item}`)?.classList.toggle('active', item === uiState.adminTab);
    document.getElementById(`ni-${item}`)?.classList.toggle('active', item === uiState.adminTab);
  });
  const titles = {
    dashboard: 'Dashboard',
    alertas: 'Alertas',
    emergencias: 'Pedidos de ajuda',
    sensores: 'Sensores ESP32',
    abrigos: 'Abrigos e apoio',
    moradores: 'Moradores',
    auditoria: 'Auditoria',
  };
  const title = document.getElementById('admtitle');
  if (title) title.textContent = titles[uiState.adminTab];
  if (uiState.adminTab === 'dashboard') renderDashboard();
  if (uiState.adminTab === 'alertas') renderAlerts();
  if (uiState.adminTab === 'emergencias') renderEmergencyRequests();
  if (uiState.adminTab === 'sensores') renderSensors();
  if (uiState.adminTab === 'abrigos') renderShelters();
  if (uiState.adminTab === 'moradores') renderMoradores();
  if (uiState.adminTab === 'auditoria') renderAudit();
}

export function toggleMenu() {
  document.getElementById('topnav')?.classList.toggle('active');
}
