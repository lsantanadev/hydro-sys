import { CONFIG } from './config.js';

function apiBaseUrl() {
  const baseUrl = CONFIG.api.baseUrl?.trim() || '';
  if (!baseUrl) {
    throw new Error('Configure HYDROSYS_CONFIG.apiBaseUrl para conectar a API.');
  }
  return baseUrl.replace(/\/$/, '');
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl()}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || 'Falha de comunicação com a API.');
  }
  return payload;
}

function jsonOptions(body, options = {}) {
  return {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(body),
  };
}

export const api = {
  health() {
    return request('/health');
  },
  sensors() {
    return request('/sensors');
  },
  createSensor(payload) {
    return request('/sensors', jsonOptions(payload, { method: 'POST' }));
  },
  updateSensor(id, payload) {
    return request(`/sensors/${encodeURIComponent(id)}`, jsonOptions(payload, { method: 'PUT' }));
  },
  deleteSensor(id) {
    return request(`/sensors/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  mapSensors() {
    return request('/map/sensors');
  },
  mapShelters() {
    return request('/map/shelters');
  },
  audit() {
    return request('/audit');
  },
  residents() {
    return request('/residents');
  },
  createResident(payload) {
    return request('/residents', jsonOptions(payload, { method: 'POST' }));
  },
  createManualOccurrence(payload) {
    return request('/manual-occurrences', jsonOptions(payload, { method: 'POST' }));
  },
  sendSensorReading(sensorCode, value, source) {
    return request('/sensors/readings', jsonOptions({
      sensor_code: sensorCode,
      water_level_cm: value,
      origin: source,
    }, { method: 'POST' }));
  },
};