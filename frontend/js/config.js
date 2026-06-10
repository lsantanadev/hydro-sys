const runtimeConfig = globalThis.HYDROSYS_CONFIG || {};
const hostname = globalThis.location?.hostname || '';
const localApiUrl = ['localhost', '127.0.0.1'].includes(hostname)
  ? `http://${hostname}:8001/api`
  : '';

export const CONFIG = {
  city: 'Palhoca',
  state: 'SC',
  center: [-27.645, -48.670],
  zoom: 13,
  bairros: [
    'Ponte do Imaruim',
    'Aririu',
    'Bela Vista',
    'Passa Vinte',
    'Centro',
    'Barra do Aririu',
    'Caminho Novo',
    'Guarda do Cubatao',
  ],
  operatorLoginEnabled: Boolean(runtimeConfig.operatorLoginEnabled),
  api: {
    baseUrl: runtimeConfig.apiBaseUrl || localApiUrl,
    pollIntervalMs: Number(runtimeConfig.pollIntervalMs) || 2000,
  },
};