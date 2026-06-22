import { openModal } from './ui.js';

export function openEmergencyCenter() {
  openModal(`
    <h3>Pedido de ajuda emergencial</h3>
    <p class="danger-note">Em risco imediato, ligue 193, 192 ou Defesa Civil. Este formulário ainda não envia pedidos aos operadores.</p>
    <div class="emergency-contacts">
      <div><strong>193</strong><span>Bombeiros</span></div>
      <div><strong>192</strong><span>SAMU / Saúde</span></div>
      <div><strong>199</strong><span>Defesa Civil</span></div>
    </div>
    <div class="form-grid modal-grid">
      <label class="field"><span>Nome</span><input id="er-name" placeholder="Opcional para visitante"></label>
      <label class="field"><span>Telefone para contato</span><input id="er-phone" placeholder="(48) 99999-9999"></label>
      <label class="field"><span>Tipo de emergência</span>
        <select id="er-type">
          <option>Pessoa ilhada</option>
          <option>Água entrando na residência</option>
          <option>Necessidade de resgate</option>
          <option>Atendimento médico</option>
          <option>Risco estrutural</option>
          <option>Falta de abrigo</option>
        </select>
      </label>
      <label class="field"><span>Urgência</span>
        <select id="er-urgency"><option>Alta</option><option>Média</option><option>Crítica</option></select>
      </label>
      <label class="field"><span>Bairro ou região</span><input id="er-area" placeholder="Centro, Aririu, Bela Vista..."></label>
      <label class="field"><span>Quantidade de pessoas</span><input id="er-people" type="number" min="1" value="1"></label>
      <label class="field span-2"><span>Endereço ou referência</span><input id="er-location" placeholder="Rua, número, ponto de referência ou local aproximado"></label>
      <label class="field span-2"><span>Observação</span><textarea id="er-note" rows="3" placeholder="Descreva rapidamente o que está acontecendo"></textarea></label>
      <p class="danger-note span-2">O pedido emergencial ainda não possui envio ou persistência. Em uma emergência real, utilize os telefones oficiais acima.</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" disabled>Envio indisponível</button>
    </div>
  `);
}

export function renderEmergencyRequests() {
  const body = document.getElementById('em-tbody');
  if (body) {
    body.innerHTML = '<tr><td colspan="6">Registro de pedidos emergenciais aguardando integração.</td></tr>';
  }
  const summary = document.getElementById('emergency-summary');
  if (summary) {
    summary.innerHTML = '<p>Pedidos emergenciais aguardam integração para serem registrados.</p>';
  }
}