import { CONFIG } from './config.js';

const TOKEN_KEY = 'hydrosys_operator_token';
const USER_KEY = 'hydrosys_auth_user';

function apiBaseUrl() {
  const baseUrl = CONFIG.api.baseUrl?.trim() || '';
  if (!baseUrl) {
    throw new Error('Configure HYDROSYS_CONFIG.apiBaseUrl para conectar a API.');
  }
  return baseUrl.replace(/\/$/, '');
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers: requestHeaders(options.headers),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(payload));
  }
  return payload;
}

function requestHeaders(headers = {}) {
  const nextHeaders = { ...headers };
  const token = authToken();
  if (token && !nextHeaders.Authorization) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }
  return nextHeaders;
}

function errorMessage(payload) {
  const detail = payload.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(item => item.msg || item.message || JSON.stringify(item))
      .join(' ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return 'Falha de comunicação com a API.';
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
  authToken,
  setAuthToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  setAuthSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearAuthToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('hydrosys_operator_user');
  },
  hasAuthToken() {
    return Boolean(authToken());
  },
  currentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    } catch {
      return {};
    }
  },
  hasOperatorSession() {
    return Boolean(authToken() && this.currentUser().role === 'OPERATOR');
  },
  health() {
    return request('/health');
  },
  login(email, password, role = 'OPERATOR') {
    return request('/auth/login', jsonOptions({ email, password, role }, { method: 'POST' }));
  },
  me() {
    return request('/auth/me');
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
  latestSensorReading(id) {
    return request(`/sensors/${encodeURIComponent(id)}/latest-reading`);
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
  manualOccurrences() {
    return request('/manual-occurrences');
  },
  closeManualOccurrence(id) {
    return request(`/manual-occurrences/${encodeURIComponent(id)}/close`, jsonOptions({}, { method: 'POST' }));
  },
  sendSensorReading(sensorCode, value, source) {
    return request('/sensors/readings', jsonOptions({
      sensor_code: sensorCode,
      water_level_cm: value,
      origin: source,
    }, { method: 'POST' }));
  },
};

function authToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
