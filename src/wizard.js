import gsap from 'gsap';

const TITLES = ['Necessidade', 'A peça', 'Prazo', 'Contato'];

// Orçamento em 4 etapas, enviado pronto para WhatsApp ou e-mail.
export function initWizard(form, { reduced, whatsapp, units, email, track, toast }) {
  const UNIT_KEY = { 'Alumínio-SP': 'aluminio', 'Rio das Ostras-RJ': 'ostras', 'Nova Friburgo-RJ': 'friburgo' };
  const phoneFor = () => units?.[UNIT_KEY[values().unidade]]?.phone || whatsapp;
  const steps = [...form.querySelectorAll('.wz-step')];
  const bars = [...form.querySelectorAll('.wizard__progress li')];
  const current = form.querySelector('[data-wz-current]');
  const title = form.querySelector('[data-wz-title]');
  const back = form.querySelector('[data-wz-back]');
  const next = form.querySelector('[data-wz-next]');
  const submit = form.querySelector('[data-wz-submit]');
  const mail = form.querySelector('[data-wz-email]');
  const status = form.querySelector('[data-form-status]');
  const summary = form.querySelector('[data-wz-summary]');
  const simBox = form.querySelector('[data-wz-sim]');
  const simText = form.querySelector('[data-wz-sim-text]');
  let index = 0;
  let simulation = null;

  steps.forEach((s) => s.querySelector('legend').setAttribute('tabindex', '-1'));

  const values = () => {
    const d = new FormData(form);
    return {
      necessidade: d.get('necessidade') || '',
      processos: d.getAll('processo').join(', '),
      peca: (d.get('peca') || '').trim(),
      quantidade: (d.get('quantidade') || '').trim(),
      dimensoes: (d.get('dimensoes') || '').trim(),
      material: (d.get('material') || '').trim(),
      mensagem: (d.get('mensagem') || '').trim(),
      setor: d.get('setor') || '',
      prazo: d.get('prazo') || '',
      unidade: d.get('unidade') || '',
      nome: (d.get('nome') || '').trim(),
      empresa: (d.get('empresa') || '').trim(),
      email: (d.get('email') || '').trim(),
      telefone: (d.get('telefone') || '').trim(),
    };
  };

  const setError = (msg) => {
    status.className = 'form__status' + (msg ? ' is-error' : '');
    status.textContent = msg || '';
  };

  function validate(i) {
    const step = steps[i];
    let first = null;
    step.querySelectorAll('[data-required-group]').forEach((group) => {
      const ok = !!group.querySelector('input:checked');
      group.classList.toggle('is-invalid', !ok);
      if (!ok && !first) first = group.querySelector('input');
    });
    step.querySelectorAll('input[required]:not([type="radio"]), textarea[required]').forEach((el) => {
      const ok = el.type === 'checkbox' ? el.checked : el.checkValidity() && el.value.trim() !== '';
      el.closest('.field, .check').classList.toggle('is-invalid', !ok);
      if (!ok && !first) first = el;
    });
    if (first) {
      setError(i === 3 ? 'Preencha os campos obrigatórios e aceite a política de privacidade.' : 'Escolha uma opção ou preencha o campo destacado para continuar.');
      first.focus({ preventScroll: true });
      if (!reduced) gsap.fromTo(steps[i], { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
      return false;
    }
    setError('');
    return true;
  }

  function renderSummary() {
    const v = values();
    const rows = [
      ['Necessidade', v.necessidade],
      ['Peça', [v.peca, v.quantidade && `${v.quantidade} un.`, v.dimensoes].filter(Boolean).join(' · ')],
      ['Setor', v.setor],
      ['Prazo', v.prazo],
      ['Simulação', simulation ? `economia estimada ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(simulation.total)}` : ''],
    ].filter(([, val]) => val);
    summary.innerHTML = rows.map(([k, val]) => `<span><b>${k}:</b> ${escapeHtml(val)}</span>`).join('') + '<button type="button" data-wz-edit>Editar respostas</button>';
    summary.querySelector('[data-wz-edit]').addEventListener('click', () => show(0));
  }

  function show(i) {
    const dir = i > index ? 1 : -1;
    const prev = steps[index];
    const nextStep = steps[i];
    if (prev !== nextStep) {
      prev.hidden = true;
      prev.classList.remove('is-active');
    }
    nextStep.hidden = false;
    nextStep.classList.add('is-active');
    if (!reduced && prev !== nextStep) gsap.fromTo(nextStep, { opacity: 0, x: 28 * dir }, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' });
    index = i;
    bars.forEach((b, n) => {
      b.classList.toggle('is-active', n === i);
      b.classList.toggle('is-done', n < i);
    });
    current.textContent = i + 1;
    title.textContent = TITLES[i];
    back.hidden = i === 0;
    next.hidden = i === steps.length - 1;
    submit.hidden = mail.hidden = i !== steps.length - 1;
    if (i === steps.length - 1) renderSummary();
    setError('');
    nextStep.querySelector('legend').focus({ preventScroll: true });
    track?.('orcamento_etapa', { etapa: i + 1 });
  }

  next.addEventListener('click', () => { if (validate(index)) show(index + 1); });
  back.addEventListener('click', () => show(index - 1));

  // Enter avança (exceto em textarea)
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (index < steps.length - 1) next.click();
    else submit.click();
  });

  form.addEventListener('change', (e) => {
    const group = e.target.closest('[data-required-group]');
    if (group) group.classList.remove('is-invalid');
  });
  form.addEventListener('input', (e) => e.target.closest('.field, .check')?.classList.remove('is-invalid'));

  function message() {
    const v = values();
    const SEP = '\u2028';
    const det = [
      v.peca && `Peça: ${v.peca}`,
      v.quantidade && `Quantidade: ${v.quantidade}`,
      v.dimensoes && `Dimensões: ${v.dimensoes}`,
      v.material && `Material: ${v.material}`,
      v.processos && `Processos que tenho interesse: ${v.processos}`,
      v.setor && `Setor: ${v.setor}`,
      `Prazo: ${v.prazo}`,
      v.unidade && `Unidade mais próxima: ${v.unidade}`,
    ].filter(Boolean);
    const lines = [
      `Olá, tudo bem? Aqui é ${v.nome}, da ${v.empresa}.`,
      `Queria um orçamento: ${v.necessidade.charAt(0).toLowerCase() + v.necessidade.slice(1)}.`,
      SEP,
      v.mensagem,
      SEP,
      'Alguns detalhes:',
      ...det,
      simulation && SEP,
      simulation && `Também fiz a simulação no site: ${simulation.text}`,
      SEP,
      `Meu contato: ${[v.email, v.telefone].filter(Boolean).join(' · ')}`,
    ];
    // campos vazios somem; SEP vira linha em branco
    return lines.filter(Boolean).map((l) => (l === SEP ? '' : l)).join('\n');
  }

  // confirmação após o envio, com link de reserva caso o WhatsApp não abra
  const done = document.createElement('div');
  done.className = 'wz-done';
  done.hidden = true;
  done.setAttribute('role', 'status');
  done.innerHTML = `
    <span class="wz-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
    <div>
      <strong>Sua mensagem está pronta no WhatsApp.</strong>
      <p>Toque em enviar na conversa e, se puder, mande fotos da peça: isso acelera o diagnóstico.</p>
      <p><a data-wz-reopen href="https://wa.me/${phoneFor()}" target="_blank" rel="noopener">O WhatsApp não abriu? Clique aqui</a> · <button type="button" data-wz-restart>Fazer outro pedido</button></p>
    </div>`;
  form.append(done);
  done.querySelector('[data-wz-restart]').addEventListener('click', () => {
    done.hidden = true;
    form.classList.remove('is-done');
    form.reset();
    form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
    show(0);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(index)) return;
    const url = `https://wa.me/${phoneFor()}?text=${encodeURIComponent(message())}`;
    window.open(url, '_blank', 'noopener');
    done.querySelector('[data-wz-reopen]').href = url;
    done.hidden = false;
    form.classList.add('is-done');
    setError('');
    if (!reduced) gsap.fromTo(done, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    track?.('orcamento_enviado', { canal: 'whatsapp' });
  });

  mail.addEventListener('click', () => {
    if (!validate(index)) return;
    const subject = `Orçamento via site — ${values().empresa}`;
    location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message())}`;
    status.className = 'form__status is-ok';
    status.textContent = 'Abrimos o seu aplicativo de e-mail com a mensagem pronta.';
    track?.('orcamento_enviado', { canal: 'email' });
  });

  simBox.querySelector('[data-wz-sim-remove]').addEventListener('click', () => {
    simulation = null;
    simBox.hidden = true;
    if (index === steps.length - 1) renderSummary();
  });

  return {
    attachSimulation(sim) {
      simulation = sim;
      simText.textContent = sim.text;
      simBox.hidden = false;
      if (index === steps.length - 1) renderSummary();
      toast?.('Simulação anexada ao orçamento');
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
