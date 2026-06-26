import { api } from './api.js';

export const uiState = {
  page: 'landing',
  adminTab: 'dashboard',
  critOnly: false,
  selectedSensorId: null,
  selectedSensorCode: null,
};

export async function loadOperationalData() {
  const [sensors, shelters, audit, residents] = await Promise.allSettled([
    loadSensors(),
    loadShelters(),
    loadAudit(),
    loadResidents(),
  ]);

  if ([sensors, shelters, audit, residents].every(result => result.status === 'rejected')) {
    throw sensors.reason || new Error('API indisponível.');
  }

  return {
    sensors: settledValue(sensors),
    shelters: settledValue(shelters),
    audit: settledValue(audit),
    residents: settledValue(residents),
  };
}

export async function loadSensors() {
  const sensors = await api.sensors();
  return sensors.map(normalizeSensor);
}

export async function loadShelters() {
  const shelters = await api.mapShelters();
  return shelters.map(normalizeShelter);
}

export async function loadAudit() {
  const audit = await api.audit();
  return audit.map(normalizeAudit);
}

export async function loadResidents() {
  const residents = await api.residents();
  return residents.map(normalizeResident);
}

export function getActiveAlerts(sensors = []) {
  return sensors
    .filter(sensor => sensor.st !== 'verde')
    .map(sensor => ({
      id: `sensor-${sensor.id}`,
      regiao: sensor.bairro || 'Não informado',
      status: sensor.st,
      level: sensor.level,
      sensor: sensor.id,
      origem: 'sensor',
    }));
}

export function statusByLevel(sensor) {
  if (sensor.level >= sensor.lr) return 'vermelho';
  if (sensor.level >= sensor.ll) return 'laranja';
  if (sensor.level >= sensor.ly) return 'amarelo';
  return 'verde';
}

function normalizeSensor(sensor) {
  const level = Number(sensor.current_level || 0);
  const ly = Number(sensor.threshold_yellow || 0);
  const ll = Number(sensor.threshold_orange || 0);
  const lr = Number(sensor.threshold_red || 0);
  const max = Math.max(20, Math.ceil(Math.max(level, lr) * 1.25));
  return {
    apiId: sensor.id,
    id: sensor.sensor_code,
    nome: sensor.name,
    bairro: sensor.neighborhood || '',
    endereco: sensor.location_description || 'Localização cadastrada',
    lat: Number(sensor.latitude),
    lng: Number(sensor.longitude),
    level,
    max,
    st: sensor.current_status || 'verde',
    status: sensor.active ? 'online' : 'offline',
    reading: formatDate(sensor.last_reading_at),
    lastReadingDiscarded: sensor.last_reading_is_valid === false,
    lastReadingSimulated: sensor.last_reading_origin === 'SIMULACAO',
    lastDiscardedAt: formatDate(sensor.last_discarded_at),
    ly,
    ll,
    lr,
  };
}

function normalizeShelter(shelter) {
  return {
    id: shelter.id,
    nome: shelter.name,
    endereco: shelter.address || 'Endereço não informado',
    lat: Number(shelter.latitude),
    lng: Number(shelter.longitude),
    cap: Number(shelter.capacity || 0),
    occ: Number(shelter.occupancy || 0),
    st: shelter.active ? 'aberto' : 'fechado',
    donations: shelter.donations || [],
  };
}

function normalizeAudit(event) {
  return {
    hora: formatDate(event.created_at || event.data_hora),
    usuario: event.actor || event.usuario || 'sistema',
    acao: event.action || event.acao || '-',
    entidade: event.entity || event.entidade || '-',
    detalhe: formatDetails(event.details ?? event.detalhe),
  };
}

function normalizeResident(resident) {
  return {
    id: resident.id,
    nome: resident.name,
    telefone: resident.whatsapp,
    email: resident.email,
    bairro: resident.neighborhood,
    rua: resident.street,
    ativo: true,
  };
}

function settledValue(result) {
  return result.status === 'fulfilled' ? result.value : [];
}

function formatDetails(details) {
  if (!details) return '-';
  if (typeof details === 'string') return details;
  return JSON.stringify(details);
}

function formatDate(value) {
  if (!value) return 'Sem leitura';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
