import { hydrateIcons } from './icons.js';
import {
  initSelects,
  doLogin,
  fazerLogout,
  subForm,
  renderMoradores,
  addCadastroEndereco,
  removeCadastroEndereco,
  openResidentSettings,
} from './auth.js';
import { goTo, initNavigation, showTab, toggleMenu } from './navigation.js';
import { initMap, applyFilters, toggleCrit, toggleMapMenu } from './map.js';
import {
  renderDashboard,
  simulateRise,
  applyPrototypeReading,
  changePrototypeLevel,
  resetPrototypeSensor,
  focusPrototypeControl,
  selectPrototypeSensor,
  startSensorPolling,
} from './dashboard.js';
import { renderAlerts, openManualModal, openPublicAlertModal, saveManualOccurrence, closeManualOccurrence } from './alertas.js';
import { renderSensors, openSensorModal, openEditSensorModal, saveSensorCreate, saveSensorEdit, deleteSensor } from './sensores.js';
import { renderShelters } from './abrigos.js';
import { openDonationManager } from './doacoes.js';
import { openEmergencyCenter, renderEmergencyRequests } from './emergencia.js';
import { renderAudit, exportAuditReport, goToAuditPage } from './auditoria.js';
import { closeModal } from './ui.js';

async function renderAll() {
  await Promise.allSettled([
    renderDashboard(),
    renderAlerts(),
    renderSensors(),
    renderShelters(),
    renderEmergencyRequests(),
    renderMoradores(),
    renderAudit(),
  ]);
}

function initRainEffect() {
  const root = document.getElementById('rain-effect');
  if (!root || root.dataset.ready === 'true') return;
  root.dataset.ready = 'true';
  for (let i = 0; i < 50; i += 1) {
    const drop = document.createElement('span');
    drop.className = 'rain-drop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.height = `${18 + Math.random() * 54}px`;
    drop.style.animationDuration = `${0.45 + Math.random() * 1.35}s`;
    drop.style.animationDelay = `${-Math.random() * 3}s`;
    root.appendChild(drop);
  }
}

Object.assign(window, {
  goTo,
  showTab,
  toggleMenu,
  doLogin,
  fazerLogout,
  subForm,
  addCadastroEndereco,
  removeCadastroEndereco,
  openResidentSettings,
  initMap,
  applyFilters,
  toggleCrit,
  toggleMapMenu,
  simulateRise,
  applyPrototypeReading,
  changePrototypeLevel,
  resetPrototypeSensor,
  focusPrototypeControl,
  selectPrototypeSensor,
  openManualModal,
  openPublicAlertModal,
  saveManualOccurrence,
  closeManualOccurrence,
  openSensorModal,
  openEditSensorModal,
  saveSensorCreate,
  saveSensorEdit,
  deleteSensor,
  openDonationManager,
  openEmergencyCenter,
  closeModal,
  exportAuditReport,
  goToAuditPage,
});

window.addEventListener('DOMContentLoaded', async () => {
  hydrateIcons();
  initRainEffect();
  initSelects();
  initNavigation();
  await renderAll();
  startSensorPolling();
  document.addEventListener('submit', event => event.preventDefault());
});
