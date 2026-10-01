// Vitrine do laser cladding: robô industrial (cinemática inversa de 2 elos) varrendo o eixo no torno.
export function initLaser(root, { reduced } = {}) {
  const svg = root?.querySelector('.laser__svg');
  if (!svg) return;
  const q = (s) => svg.querySelector(s);
  const l1 = q('[data-lz-l1]'), l2 = q('[data-lz-l2]'), head = q('[data-lz-head]'), cable = q('[data-lz-cable]'), hose = q('[data-lz-hose]');
  const beam = q('[data-lz-beam]'), cone = q('[data-lz-cone]'), glow = q('[data-lz-glow]');
  const bead = q('[data-lz-bead]'), bead2 = q('[data-lz-bead2]'), sparks = q('[data-lz-sparks]'), fume = q('[data-lz-fume]');
  const NS = 'http://www.w3.org/2000/svg';
  // giro da peça: castanhas da placa girando
  const jaws = [...svg.querySelectorAll('[data-lz-jaws] rect')];
  const spinStep = (a) => {
    jaws.forEach((j, i) => {
      const phi = a + (i / jaws.length) * Math.PI * 2;
      j.setAttribute('y', 351 - 26 * Math.cos(phi));
      j.style.opacity = Math.sin(phi) > 0 ? 1 : 0.35;
    });
  };
  const base = { x: 150, y: 302 }, L1 = 230, L2 = 200;
  const X0 = 336, X1 = 548, TOP = 331, HEAD = 44, GAP = 12;
  const deg = (r) => (r * 180) / Math.PI;
  let t = 0, last = 0, raf = 0, visible = false;

  const pose = (tx, wob) => {
    const wx = tx, wy = TOP - GAP - HEAD - 20 + wob; // flange do punho
    const dx = wx - base.x, dy = wy - base.y;
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
    const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const q2 = Math.acos(Math.max(-1, Math.min(1, c2)));
    const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    const ex = base.x + L1 * Math.cos(q1), ey = base.y + L1 * Math.sin(q1);
    l1.setAttribute('transform', `translate(${base.x} ${base.y}) rotate(${deg(q1)})`);
    l2.setAttribute('transform', `translate(${ex} ${ey}) rotate(${deg(q1 + q2)})`);
    head.setAttribute('transform', `translate(${wx} ${wy + 20})`);
    // cabo de energia/fibra: da base, por cima dos elos, até o topo do cabeçote
    const hx = wx, hy = wy + 2;
    cable.setAttribute('d', `M${base.x - 20} ${base.y + 8} Q${(base.x + ex) / 2 - 26} ${(base.y + ey) / 2 - 26} ${ex - 4} ${ey - 24} Q${(ex + hx) / 2} ${Math.min(ey, hy) - 34} ${hx - 4} ${hy}`);
    // mangueira de pó: do cotovelo até a entrada lateral do cabeçote
    hose.setAttribute('d', `M${ex + 6} ${ey - 20} Q${(ex + hx) / 2 + 10} ${Math.min(ey, hy) - 22} ${hx + 13} ${hy + 26}`);
    return { x: wx, tip: wy + 20 + HEAD };
  };

  const step = (dt) => {
    t += dt;
    const cycle = 8, u = (t % cycle) / cycle;
    const k = Math.min(1, u / 0.82);
    const tx = X0 + (X1 - X0) * k;
    const on = u < 0.82;
    spinStep(t * 3.2);
    const p = pose(tx, on ? Math.sin(t * 9) * 0.6 : 0);
    const w = Math.max(0, tx - X0);
    bead.setAttribute('width', w); bead2.setAttribute('width', w);
    beam.setAttribute('x1', p.x); beam.setAttribute('y1', p.tip);
    beam.setAttribute('x2', p.x); beam.setAttribute('y2', TOP);
    cone.setAttribute('d', `M${p.x - 3} ${p.tip} L${p.x + 3} ${p.tip} L${p.x + 1} ${TOP} L${p.x - 1} ${TOP} Z`);
    beam.style.opacity = cone.style.opacity = on ? 1 : 0;
    glow.setAttribute('cx', p.x); glow.setAttribute('cy', TOP);
    glow.setAttribute('r', 18 + Math.random() * 6);
    glow.style.opacity = on ? 0.85 + Math.random() * 0.15 : 0;
    if (on && !reduced) {
      if (Math.random() < 0.5) spark(p.x);
      if (Math.random() < 0.12) puff(p.x);
    }
  };

  const spark = (x) => {
    const s = document.createElementNS(NS, 'line');
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, l = 4 + Math.random() * 12;
    s.setAttribute('x1', x); s.setAttribute('y1', TOP - 1);
    s.setAttribute('x2', x + Math.cos(a) * l); s.setAttribute('y2', TOP - 1 + Math.sin(a) * l);
    s.setAttribute('class', 'laser__spark');
    sparks.appendChild(s);
    setTimeout(() => s.remove(), 260);
  };
  const puff = (x) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', TOP - 6); c.setAttribute('r', 5);
    c.setAttribute('class', 'laser__fume');
    fume.appendChild(c);
    setTimeout(() => c.remove(), 1600);
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt);
    raf = visible ? requestAnimationFrame(frame) : 0;
  };

  if (reduced) { t = 4; step(0); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }).observe(svg);
  step(0);
}
