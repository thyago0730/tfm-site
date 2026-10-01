// Vista explodida da nacele (setor eólico) contada como história em loop:
// operando → vibração → desmontagem → multiplicadora → eixo → recuperado → operando.
const STORY = [
  { phase: 'run', step: 0, t: 4500 },
  { phase: 'fault', step: 0, t: 3200 },
  { phase: 'open', step: 1, t: 3200 },
  { phase: 'gear', step: 2, t: 3800 },
  { phase: 'shaft', step: 3, t: 4200 },
  { phase: 'fixed', step: 3, t: 2600 },
  { phase: 'close', step: 0, t: 1600 },
];
const TEXT = { run: 'run', fault: 'fault', open: '1', gear: '2', shaft: '3', fixed: 'fixed', close: 'fixed' };

export function initExplode(root) {
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tabs = [...root.querySelectorAll('[data-ex-go]')];
  const texts = new Map([...root.querySelectorAll('[data-ex-text]')].map((t) => [t.dataset.exText, t]));
  const blades = root.querySelector('[data-ex-blades]');
  const NS = 'http://www.w3.org/2000/svg';
  let i = 0, timer = 0, user = false, visible = false;

  // rotor de 3 pás visto de lado: cada pá aparece como uma faixa vertical que encurta com o giro
  const bladeEls = [0, 1, 2].map(() => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('fill', 'url(#ex-shell)');
    blades.appendChild(p);
    return p;
  });
  const HX = 214, HY = 251, L = 215;
  let ang = 0.4, omega = 0, target = 0, raf = 0, last = 0;
  const drawRotor = () => {
    bladeEls.forEach((p, k) => {
      const a = ang + (k * Math.PI * 2) / 3;
      const len = L * Math.cos(a), depth = Math.sin(a);
      const w0 = 11, w1 = 5;
      p.setAttribute('d', `M${HX - w0} ${HY} L${HX - w1} ${HY - len} L${HX + w1} ${HY - len} L${HX + w0} ${HY} Z`);
      p.setAttribute('opacity', (0.55 + 0.45 * (depth * 0.5 + 0.5)).toFixed(2));
      blades.appendChild(depth > 0 ? p : blades.insertBefore(p, blades.firstChild));
    });
  };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    omega += (target - omega) * (1 - Math.exp(-(target > omega ? 0.9 : 1.4) * dt));
    ang += omega * dt;
    drawRotor();
    raf = visible && (omega > 0.01 || target > 0) ? requestAnimationFrame(tick) : 0;
  };
  const spin = (w) => {
    target = reduced ? 0 : w;
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };

  const show = (phase, step) => {
    root.dataset.step = step;
    root.dataset.phase = phase;
    tabs.forEach((t, k) => t.setAttribute('aria-pressed', String(k === step && !['run', 'fault', 'fixed', 'close'].includes(phase))));
    const key = TEXT[phase];
    texts.forEach((el, k) => (el.hidden = k !== key));
    spin(phase === 'run' || phase === 'close' ? 1.6 : 0);
  };
  const play = () => {
    clearTimeout(timer);
    if (user || !visible || reduced) return;
    const s = STORY[i];
    show(s.phase, s.step);
    timer = setTimeout(() => { i = (i + 1) % STORY.length; play(); }, s.t);
  };
  const manual = (step) => {
    user = true;
    clearTimeout(timer);
    show(['run', 'open', 'gear', 'shaft'][step], step);
  };
  let cur = 0;
  tabs.forEach((t, k) => t.addEventListener('click', () => manual((cur = k))));
  root.querySelector('[data-ex-prev]').addEventListener('click', () => manual((cur = (cur + 3) % 4)));
  root.querySelector('[data-ex-next]').addEventListener('click', () => manual((cur = (cur + 1) % 4)));

  drawRotor();
  show('run', 0);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { play(); spin(target || (root.dataset.phase === 'run' ? 1.6 : 0)); }
    else clearTimeout(timer);
  }, { threshold: 0.35 }).observe(root);
}
