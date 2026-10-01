import gsap from 'gsap';

const TITLES = ['Necessidade', 'A peça', 'Prazo', 'Contato'];

// Orçamento em 4 etapas, enviado pronto para WhatsApp ou e-mail.
export function initWizard(form, { reduced, whatsapp, email, track, toast }) {
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
    const lines = [
      'Olá, TFM! Gostaria de solicitar um orçamento.',
      SEP,
      `• Necessidade: ${v.necessidade}`,
      v.processos && `• Processos de interesse: ${v.processos}`,
      v.peca && `• Peça: ${v.peca}`,
      v.quantidade && `• Quantidade: ${v.quantidade}`,
      v.dimensoes && `• Dimensões: ${v.dimensoes}`,
      v.material && `• Material: ${v.material}`,
      v.setor && `• Setor: ${v.setor}`,
      `• Prazo: ${v.prazo}`,
      v.unidade && `• Unidade de preferência: ${v.unidade}`,
      SEP,
      `Descrição: ${v.mensagem}`,
      simulation && SEP,
      simulation && `Simulação do site: ${simulation.text}`,
      SEP,
      `${v.nome} — ${v.empresa}`,
      v.email,
      v.telefone,
    ];
    // campos vazios somem; SEP vira linha em branco
    return lines.filter(Boolean).map((l) => (l === SEP ? '' : l)).join('\n');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(index)) return;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(message())}`, '_blank', 'noopener');
    status.className = 'form__status is-ok';
    status.textContent = 'Abrimos o WhatsApp com a sua mensagem pronta. É só enviar!';
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
