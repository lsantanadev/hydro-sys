import { CONFIG } from './config.js';
import { api } from './api.js';
import { loadResidents } from './state.js';
import { goTo } from './navigation.js';
import { openModal, toast } from './ui.js';

let addressCounter = 0;

export function initSelects() {
  const cadastro = document.getElementById('fbairro');
  if (cadastro) cadastro.innerHTML = bairroOptions();
  const filtro = document.getElementById('fb');
  if (filtro) filtro.innerHTML = `<option value="">Todos os bairros</option>${CONFIG.bairros.map(bairro => `<option value="${bairro}">${bairro}</option>`).join('')}`;
  const senhaCadastro = document.getElementById('fsenha');
  if (senhaCadastro) {
    senhaCadastro.value = '';
    senhaCadastro.disabled = true;
    senhaCadastro.placeholder = 'Login de morador ainda indisponível';
  }
}

export async function doLogin() {
  const perfil = document.getElementById('lperfil')?.value || 'MORADOR';
  const nomePerfil = perfil === 'OPERADOR' ? 'operador' : 'morador';
  if (perfil !== 'OPERADOR') {
    toast(`O login de ${nomePerfil} aguardara autenticacao pela API.`);
    return;
  }
  const email = value('le').toLowerCase();
  const password = document.getElementById('lp')?.value || '';
  if (!email || !password) {
    toast('Informe e-mail e senha do operador.');
    return;
  }
  try {
    const session = await api.login(email, password);
    api.setAuthToken(session.access_token);
    localStorage.setItem('hydrosys_operator_user', JSON.stringify(session.user));
    toast('Operador autenticado.');
    goTo('admin');
  } catch (error) {
    api.clearAuthToken();
    localStorage.removeItem('hydrosys_operator_user');
    toast(error.message);
  }
}

export function fazerLogout() {
  api.clearAuthToken();
  localStorage.removeItem('hydrosys_operator_user');
  toast('Sessao encerrada.');
  goTo('landing');
}

export async function subForm() {
  const nome = value('fn');
  const telefone = value('fw');
  const email = value('fem').toLowerCase();
  const cons = document.getElementById('fcons')?.checked;
  if (!nome) return toast('Informe o nome do morador.');
  if (!telefone || !email) return toast('Informe telefone e e-mail para continuar.');
  if (!cons) return toast('Aceite o termo LGPD para continuar.');

  const addresses = collectRegistrationAddresses();
  if (!addresses) return;

  const submit = document.getElementById('resident-submit');
  if (submit) {
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
  }
  try {
    await api.createResident({
      name: nome,
      whatsapp: telefone,
      email,
      neighborhood: addresses[0].bairro,
      street: addresses[0].rua,
      consent: cons,
    });
    document.getElementById('cad-form-box').hidden = true;
    document.getElementById('cad-succ-box').hidden = false;
    const successText = document.querySelector('#cad-succ-box p');
    if (successText) successText.textContent = 'Cadastro confirmado pela API. O login sera liberado quando a autenticacao estiver implementada.';
    await renderMoradores();
    toast('Cadastro confirmado pela API.');
  } catch (error) {
    toast(error.message);
    if (submit) {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  }
}

export async function renderMoradores() {
  const body = document.getElementById('mor-tbody');
  if (!body) return;
  try {
    const moradores = await loadResidents();
    body.innerHTML = moradores.map(morador => `
      <tr>
        <td>${escapeHtml(morador.nome)}</td>
        <td>${escapeHtml(morador.telefone)}</td>
        <td>${escapeHtml(morador.bairro)}</td>
        <td><span class="badge good">Ativo</span></td>
      </tr>
    `).join('') || '<tr><td colspan="4">Nenhum morador cadastrado.</td></tr>';
  } catch (error) {
    body.innerHTML = `<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`;
  }
}

export function addCadastroEndereco() {
  const root = document.getElementById('cad-extra-addresses');
  if (!root) return;
  addressCounter += 1;
  const id = `cad-address-${addressCounter}`;
  root.insertAdjacentHTML('beforeend', `
    <section class="address-entry" id="${id}">
      <div class="address-entry-head">
        <h4>Endereço adicional</h4>
        <button class="btn btn-ghost" type="button" onclick="removeCadastroEndereco('${id}')">Remover</button>
      </div>
      <div class="form-grid address-grid">
        <label class="field"><span>Bairro</span><select data-field="bairro">${bairroOptions()}</select></label>
        <label class="field"><span>Rua</span><input data-field="rua" placeholder="Rua das Flores"></label>
        <label class="field"><span>Número</span><input data-field="numero" placeholder="123"></label>
        <label class="field"><span>CEP</span><input data-field="cep" placeholder="88130-000"></label>
        <label class="field span-2"><span>Referência</span><input data-field="referencia" placeholder="Próximo à escola"></label>
      </div>
      <small>Endereço temporário: será mantido apenas até o envio do cadastro.</small>
    </section>
  `);
}

export function removeCadastroEndereco(id) {
  document.getElementById(id)?.remove();
}

export function openResidentSettings() {
  openModal(`
    <h3>Configurações da conta</h3>
    <p class="danger-note">As configurações do morador aguardam autenticação pela API. Nenhum endereço será salvo localmente.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" type="button" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

function collectRegistrationAddresses() {
  const primary = {
    bairro: value('fbairro'),
    rua: value('frua'),
    numero: value('fnumero'),
    cep: value('fcep'),
    referencia: value('fref'),
  };
  if (!validAddress(primary)) {
    toast('Informe bairro, rua, número e CEP do endereço principal.');
    return null;
  }
  const extra = [...document.querySelectorAll('#cad-extra-addresses .address-entry')].map(entry => ({
    bairro: fieldValue(entry, 'bairro'),
    rua: fieldValue(entry, 'rua'),
    numero: fieldValue(entry, 'numero'),
    cep: fieldValue(entry, 'cep'),
    referencia: fieldValue(entry, 'referencia'),
  }));
  if (extra.some(address => !validAddress(address))) {
    toast('Preencha todos os campos obrigatorios dos enderecos adicionais.');
    return null;
  }
  return [primary, ...extra];
}

function validAddress(address) {
  return Boolean(address.bairro && address.rua && address.numero && address.cep);
}

function fieldValue(root, field) {
  return root.querySelector(`[data-field="${field}"]`)?.value.trim() || '';
}

function value(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function bairroOptions() {
  return `<option value="">Selecione...</option>${CONFIG.bairros.map(bairro => `<option value="${bairro}">${bairro}</option>`).join('')}`;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
