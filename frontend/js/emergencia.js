import { openModal } from './ui.js';

export function openEmergencyCenter() {
  openModal(`
    <h3>Pedido de ajuda emergencial</h3>
    <p class="danger-note">Em risco imediato, ligue 193, 192 ou Defesa Civil. Este formulario ainda nao envia pedidos aos operadores.</p>
    <div class="emergency-contacts">
      <div><strong>193</strong><span>Bombeiros</span></div>
      <div><strong>192</strong><span>SAMU / Saude</span></div>
      <div><strong>199</strong><span>Defesa Civil</span></div>
    </div>
    <div class="form-grid modal-grid">
      <label class="field"><span>Nome</span><input id="er-name" placeholder="Opcional para visitante"></label>
      <label class="field"><span>Telefone para contato</span><input id="er-phone" placeholder="(48) 99999-9999"></label>
      <label class="field"><span>Tipo de emergencia</span>
        <select id="er-type">
          <option>Pessoa ilhada</option>
          <option>Agua entrando na residencia</option>
          <option>Necessidade de resgate</option>
          <option>Atendimento medico</option>
          <option>Risco estrutural</option>
          <option>Falta de abrigo</option>
        </select>
      </label>
      <label class="field"><span>Urgencia</span>
        <select id="er-urgency"><option>Alta</option><option>Media</option><option>Critica</option></select>
      </label>
      <label class="field"><span>Bairro ou regiao</span><input id="er-area" placeholder="Centro, Aririu, Bela Vista..."></label>
      <label class="field"><span>Quantidade de pessoas</span><input id="er-people" type="number" min="1" value="1"></label>
      <label class="field span-2"><span>Endereco ou referencia</span><input id="er-location" placeholder="Rua, numero, ponto de referencia ou local aproximado"></label>
      <label class="field span-2"><span>Observacao</span><textarea id="er-note" rows="3" placeholder="Descreva rapidamente o que esta acontecendo"></textarea></label>
      <p class="danger-note span-2">O pedido emergencial ainda nao possui envio ou persistencia. Em uma emergencia real, utilize os telefones oficiais acima.</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" disabled>Envio indisponivel</button>
    </div>
  `);
}

export function renderEmergencyRequests() {
  const body = document.getElementById('em-tbody');
  if (body) {
    body.innerHTML = '<tr><td colspan="6">Registro de pedidos emergenciais aguardando integracao.</td></tr>';
  }
  const summary = document.getElementById('emergency-summary');
  if (summary) {
    summary.innerHTML = '<p>Pedidos emergenciais aguardam integracao para serem registrados.</p>';
  }
}