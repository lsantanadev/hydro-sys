import { CONFIG } from './config.js';
import { api } from './api.js';
import { state, syncOperationalState } from './state.js';
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
    senhaCadastro.placeholder = 'Login de morador ainda indisponivel';
  }
}

export function doLogin() {
  const perfil = document.getElementById('lperfil')?.value || 'MORADOR';
  const nomePerfil = perfil === 'OPERADOR' ? 'operador' : 'morador';
  toast(`O login de ${nomePerfil} aguarda autenticacao pela API.`);
}

export function fazerLogout() {
  state.loggedUser = null;
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

  try {
    await api.createResident({
      name: nome,
      whatsapp: telefone,
      email,
      neighborhood: addresses[0].bairro,
      street: addresses[0].rua,
      consent: true,
    });
    await syncOperationalState();
    document.getElementById('cad-form-box').hidden = true;
    document.getElementById('cad-succ-box').hidden = false;
    toast(addresses.length > 1
      ? 'Cadastro principal concluido. Enderecos adicionais nao foram persistidos.'
      : 'Cadastro concluido. O login aguarda autenticacao pela API.');
  } catch (error) {
    toast(error.message);
  }
}

export function renderMoradores() {
  const body = document.getElementById('mor-tbody');
  if (!body) return;
  body.innerHTML = state.moradores.map(morador => `
    <tr>
      <td>${escapeHtml(morador.nome)}</td>
      <td>${escapeHtml(morador.telefone)}</td>
      <td>${escapeHtml(morador.bairro)}</td>
      <td><span class="badge good">Ativo</span></td>
    </tr>
  `).join('') || '<tr><td colspan="4">Nenhum morador cadastrado.</td></tr>';
}

export function addCadastroEndereco() {
  const root = document.getElementById('cad-extra-addresses');
  if (!root) return;
  addressCounter += 1;
  const id = `cad-address-${addressCounter}`;
  root.insertAdjacentHTML('beforeend', `
    <section class="address-entry" id="${id}">
      <div class="address-entry-head">
        <h4>Endereco adicional</h4>
        <button class="btn btn-ghost" type="button" onclick="removeCadastroEndereco('${id}')">Remover</button>
      </div>
      <div class="form-grid address-grid">
        <label class="field"><span>Bairro</span><select data-field="bairro">${bairroOptions()}</select></label>
        <label class="field"><span>Rua</span><input data-field="rua" placeholder="Rua das Flores"></label>
        <label class="field"><span>Numero</span><input data-field="numero" placeholder="123"></label>
        <label class="field"><span>CEP</span><input data-field="cep" placeholder="88130-000"></label>
        <label class="field span-2"><span>Referencia</span><input data-field="referencia" placeholder="Proximo a escola"></label>
      </div>
      <small>Endereco temporario: sera mantido apenas durante esta sessao.</small>
    </section>
  `);
}

export function removeCadastroEndereco(id) {
  document.getElementById(id)?.remove();
}

export function openResidentSettings() {
  if (state.loggedUser?.perfil !== 'MORADOR') return toast('Entre como morador para acessar as configuracoes.');
  const addresses = state.loggedUser.enderecos || [];
  openModal(`
    <h3>Configuracoes da conta</h3>
    <p>Enderecos cadastrados para recebimento de alertas.</p>
    <div class="saved-addresses">
      ${addresses.map((address, index) => `
        <article class="saved-address">
          <span class="badge ${index === 0 ? 'good' : 'warning'}">${index === 0 ? 'Principal' : 'Adicional'}</span>
          <strong>${escapeHtml(address.rua)}, ${escapeHtml(address.numero)}</strong>
          <small>${escapeHtml(address.bairro)} - CEP ${escapeHtml(address.cep)}${address.referencia ? ` - ${escapeHtml(address.referencia)}` : ''}</small>
        </article>
      `).join('') || '<p>Nenhum endereco cadastrado.</p>'}
    </div>
    <h4 class="settings-title">Cadastrar novo endereco</h4>
    <p class="danger-note">O cadastro de novos enderecos ainda nao possui persistencia e permanece bloqueado.</p>
    <div class="form-grid modal-grid">
      <label class="field"><span>Bairro</span><select disabled>${bairroOptions()}</select></label>
      <label class="field"><span>Rua</span><input disabled placeholder="Aguardando integracao"></label>
      <label class="field"><span>Numero</span><input disabled placeholder="Aguardando integracao"></label>
      <label class="field"><span>CEP</span><input disabled placeholder="Aguardando integracao"></label>
      <label class="field span-2"><span>Referencia</span><input disabled placeholder="Aguardando integracao"></label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" type="button" onclick="closeModal()">Fechar</button>
      <button class="btn btn-primary" type="button" disabled>Cadastro indisponivel</button>
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
    toast('Informe bairro, rua, numero e CEP do endereco principal.');
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
