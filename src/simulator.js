import gsap from 'gsap';

// Simulador "recuperar × substituir". Todas as premissas são editáveis.
const DEFAULTS = { novo: 80000, prazoNovo: 90, custoRec: 40, prazoRec: 15, custoDia: 20000, peso: 800, parado: true };
const CO2_POR_KG_ACO = 1.9; // média global aproximada (worldsteel)

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const compactBRL = (v) => {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}R$ ${num1.format(a / 1e6)} mi`;
  if (a >= 1e4) return `${sign}R$ ${num.format(Math.round(a / 1e3))} mil`;
  return `${sign}${brl.format(a)}`;
};

function niceRound(key, v) {
  if (key === 'peso') return v < 100 ? Math.round(v) : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 100) * 100;
  if (v < 100000) return Math.round(v / 1000) * 1000;
  return Math.round(v / 5000) * 5000;
}

export function initSimulator(root, { reduced, onSend }) {
  const state = { ...DEFAULTS };
  const ranges = new Map([...root.querySelectorAll('[data-sim-range]')].map((r) => [r.dataset.simRange, r]));
  const texts = new Map([...root.querySelectorAll('[data-sim-text]')].map((t) => [t.dataset.simText, t]));
  const check = root.querySelector('[data-sim-check="parado"]');
  const out = (k) => root.querySelector(`[data-sim-out="${k}"]`);
  const seg = (k) => root.querySelector(`[data-seg="${k}"]`);
  const tip = root.querySelector('[data-sim-tip]');
  const tableBody = root.querySelector('[data-sim-table]');
  const totalEl = out('total');
  const shown = { total: 0 };

  // conversões do slider (lineares ou logarítmicas)
  const toValue = (range) => {
    const t = (range.value - range.min) / (range.max - range.min);
    if (!range.hasAttribute('data-log')) return +range.value;
    const min = +range.dataset.min, max = +range.dataset.max;
    return niceRound(range.dataset.simRange, (min + 1) * Math.pow((max + 1) / (min + 1), t) - 1);
  };
  const toSlider = (range, v) => {
    if (!range.hasAttribute('data-log')) return Math.max(+range.min, Math.min(+range.max, v));
    const min = +range.dataset.min, max = +range.dataset.max;
    const t = Math.log((Math.max(min, Math.min(max, v)) + 1) / (min + 1)) / Math.log((max + 1) / (min + 1));
    return +range.min + t * (range.max - range.min);
  };
  const paintRange = (range) => {
    const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty('--fill', `${pct}%`);
  };

  const syncField = (key, fromText = false) => {
    const range = ranges.get(key);
    range.value = toSlider(range, state[key]);
    paintRange(range);
    if (!fromText) texts.get(key).value = num.format(state[key]);
  };

  ranges.forEach((range, key) => {
    range.addEventListener('input', () => {
      state[key] = toValue(range);
      syncField(key);
      compute();
    });
  });
  texts.forEach((input, key) => {
    input.addEventListener('input', () => {
      const v = parseInt(input.value.replace(/\D/g, ''), 10);
      if (Number.isNaN(v)) return;
      state[key] = key === 'custoRec' ? Math.min(v, 100) : Math.min(v, 1e9);
      syncField(key, true);
      compute();
    });
    input.addEventListener('blur', () => { input.value = num.format(state[key]); });
    input.addEventListener('focus', () => input.select());
  });
  check.addEventListener('change', () => {
    state.parado = check.checked;
    compute();
  });

  function calc() {
    const custoServico = (state.novo * state.custoRec) / 100;
    const diasNovo = state.parado ? state.prazoNovo * state.custoDia : 0;
    const diasRec = state.parado ? state.prazoRec * state.custoDia : 0;
    return {
      custoServico,
      novoAcq: state.novo,
      novoStop: diasNovo,
      recAcq: custoServico,
      recStop: diasRec,
      custoNovo: state.novo + diasNovo,
      custoRecTotal: custoServico + diasRec,
      aquisicao: state.novo - custoServico,
      parada: diasNovo - diasRec,
      dias: state.prazoNovo - state.prazoRec,
      aco: state.peso,
      co2: (state.peso * CO2_POR_KG_ACO) / 1000,
    };
  }

  let last = null;
  function compute() {
    const r = calc();
    last = r;
    const total = r.custoNovo - r.custoRecTotal;

    gsap.to(shown, {
      total,
      duration: reduced ? 0 : 0.6,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => { totalEl.textContent = brl.format(Math.round(shown.total)).replace('-', '−'); },
    });
    totalEl.classList.toggle('is-neg', total < 0);

    const dias = out('dias');
    dias.textContent = num.format(Math.abs(r.dias));
    dias.parentElement.lastChild.textContent = r.dias >= 0 ? ' dias a menos de espera' : ' dias a mais de espera';

    out('aquisicao').textContent = compactBRL(r.aquisicao);
    out('parada').textContent = state.parado ? compactBRL(r.parada) : '—';
    out('aco').textContent = r.aco >= 1000 ? `${num1.format(r.aco / 1000)} t` : `${num.format(r.aco)} kg`;
    out('co2').textContent = r.co2 >= 1 ? `${num1.format(r.co2)} t` : `${num.format(r.co2 * 1000)} kg`;
    out('custoNovo').textContent = compactBRL(r.custoNovo);
    out('custoRec').textContent = compactBRL(r.custoRecTotal);

    // barras empilhadas: largura proporcional ao maior cenário
    const max = Math.max(r.custoNovo, r.custoRecTotal, 1);
    [['novo', r.novoAcq, r.novoStop], ['rec', r.recAcq, r.recStop]].forEach(([row, acq, stop]) => {
      const a = seg(`${row}-acq`), s = seg(`${row}-stop`);
      a.style.width = `${(acq / max) * 100}%`;
      s.style.width = `${(stop / max) * 100}%`;
      a.dataset.value = acq;
      s.dataset.value = stop;
      a.classList.toggle('is-zero', acq <= 0);
      s.classList.toggle('is-zero', stop <= 0);
      a.classList.toggle('is-last', stop <= 0);
      s.classList.toggle('is-last', stop > 0);
    });

    tableBody.innerHTML = `
      <tr><th>Substituir</th><td>${brl.format(r.novoAcq)}</td><td>${brl.format(r.novoStop)}</td><td>${brl.format(r.custoNovo)}</td></tr>
      <tr><th>Recuperar</th><td>${brl.format(r.recAcq)}</td><td>${brl.format(r.recStop)}</td><td>${brl.format(r.custoRecTotal)}</td></tr>`;
  }

  // tooltip dos segmentos
  const labels = { acq: 'Aquisição ou serviço', stop: 'Parada de produção' };
  const showTip = (el) => {
    const [row, kind] = el.dataset.seg.split('-');
    const fig = el.closest('figure').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    tip.innerHTML = `<b>${row === 'novo' ? 'Substituir' : 'Recuperar'}</b><span>${labels[kind]}: ${brl.format(+el.dataset.value)}</span>`;
    tip.style.left = `${r.left - fig.left + r.width / 2}px`;
    tip.style.top = `${r.top - fig.top}px`;
    tip.hidden = false;
  };
  root.querySelectorAll('.seg').forEach((el) => {
    el.addEventListener('pointerenter', () => showTip(el));
    el.addEventListener('focus', () => showTip(el));
    el.addEventListener('pointerleave', () => { tip.hidden = true; });
    el.addEventListener('blur', () => { tip.hidden = true; });
  });

  root.querySelector('[data-sim-send]').addEventListener('click', () => {
    const r = last || calc();
    const total = r.custoNovo - r.custoRecTotal;
    const text = [
      `peça nova ${brl.format(state.novo)} (${state.prazoNovo} dias)`,
      `recuperação estimada em ${state.custoRec}% (${state.prazoRec} dias)`,
      state.parado ? `parada ${brl.format(state.custoDia)}/dia` : 'sem custo de parada',
      `peso ${num.format(state.peso)} kg`,
      `economia estimada ${brl.format(total)}`,
    ].join(' · ');
    onSend?.({ text, state: { ...state }, total });
  });

  [...ranges.keys()].forEach((k) => syncField(k));
  compute();
}
