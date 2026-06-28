import { api } from './api.js';

export const uiState = {
  page: 'landing',
  adminTab: 'dashboard',
  critOnly: false,
  selectedSensorId: null,
  selectedSensorCode: null,
};

export async function loadOperationalData() {
  const [sensors, shelters, audit, residentCount] = await Promise.allSettled([
    loadSensors(),
    loadShelters(),
    loadAudit(),
    loadResidentCount(),
  ]);

  if ([sensors, shelters, audit, residentCount].every(result => result.status === 'rejected')) {
    throw sensors.reason || new Error('API indisponível.');
  }

  return {
    sensors: settledValue(sensors),
    shelters: settledValue(shelters),
    audit: settledValue(audit),
    residentCount: settledValue(residentCount, 0),
  };
}

export async function loadSensors() {
  const sensors = await api.sensors();
  return sensors.map(normalizeSensor);
}

export async function loadMapSensors() {
  const sensors = await api.mapSensors();
  return sensors.map(normalizeMapSensor);
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

export async function loadResidentCount() {
  const payload = await api.residentCount();
  return Number(payload.count || 0);
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

function normalizeMapSensor(sensor) {
  const level = Number(sensor.current_level || 0);
  const status = normalizeSensorStatus(sensor.current_status);
  const neighborhood = sensor.neighborhood || '';
  return {
    apiId: sensor.id,
    id: String(sensor.id),
    nome: sensor.name,
    bairro: neighborhood,
    bairroKey: normalizeTextKey(neighborhood),
    endereco: neighborhood ? `Bairro ${neighborhood}` : 'Localizacao cadastrada',
    lat: Number(sensor.latitude),
    lng: Number(sensor.longitude),
    level,
    max: Math.max(20, Math.ceil(level * 1.25)),
    st: status,
    status: 'online',
    reading: formatDate(sensor.last_reading_at),
  };
}

function normalizeSensorStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return ['verde', 'amarelo', 'laranja', 'vermelho'].includes(normalized) ? normalized : 'verde';
}

export function normalizeTextKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeShelter(shelter) {
  const capacity = Number(shelter.capacity || 0);
  const occupancy = Number(shelter.occupancy || 0);
  const latitude = Number(shelter.latitude);
  const longitude = Number(shelter.longitude);
  return {
    id: shelter.id,
    nome: shelter.name,
    endereco: shelter.address || 'Endereco nao informado',
    lat: latitude,
    lng: longitude,
    cap: capacity,
    occ: occupancy,
    vagas: Number.isFinite(Number(shelter.available_spots))
      ? Number(shelter.available_spots)
      : Math.max(0, capacity - occupancy),
    st: 'aberto',
    donations: [],
  };
}

function normalizeAudit(event) {
  return {
    hora: formatAuditDate(event.created_at || event.data_hora),
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

function settledValue(result, fallback = []) {
  return result.status === 'fulfilled' ? result.value : fallback;
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

function formatAuditDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
