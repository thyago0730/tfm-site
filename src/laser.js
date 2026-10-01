// Vitrine do laser cladding: robô de 2 elos (cinemática inversa) varrendo o eixo.
export function initLaser(root, { reduced } = {}) {
  const svg = root?.querySelector('.laser__svg');
  if (!svg) return;
  const q = (s) => svg.querySelector(s);
  const a1 = q('[data-lz-a1]'), a2 = q('[data-lz-a2]'), j0 = q('[data-lz-j0]'), j1 = q('[data-lz-j1]');
  const head = q('[data-lz-head]'), beam = q('[data-lz-beam]'), glow = q('[data-lz-glow]'), bead = q('[data-lz-bead]');
  const sparks = q('[data-lz-sparks]');
  const base = { x: 150, y: 335 }, L1 = 230, L2 = 210;
  const X0 = 320, X1 = 545, TOP = 328, HEAD = 42, GAP = 14;
  let t = 0, last = 0, raf = 0, visible = false;

  const pose = (tx) => {
    const wx = tx, wy = TOP - GAP - HEAD; // punho acima do bocal
    const dx = wx - base.x, dy = wy - base.y;
    const d = Math.min(Math.hypot(dx, dy), L1 + L2 - 1);
    const c2 = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const q2 = Math.acos(Math.max(-1, Math.min(1, c2))); // cotovelo para cima
    const q1 = Math.atan2(dy, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
    const ex = base.x + L1 * Math.cos(q1), ey = base.y + L1 * Math.sin(q1);
    a1.setAttribute('d', `M${base.x} ${base.y} L${ex} ${ey}`);
    a2.setAttribute('d', `M${ex} ${ey} L${wx} ${wy}`);
    j0.setAttribute('cx', base.x); j0.setAttribute('cy', base.y);
    j1.setAttribute('cx', ex); j1.setAttribute('cy', ey);
    head.setAttribute('transform', `translate(${wx} ${wy})`);
    return { x: wx, tip: wy + HEAD };
  };

  const step = (dt) => {
    t += dt;
    const cycle = 7, u = (t % cycle) / cycle;
    const k = Math.min(1, u / 0.85); // varre e pausa
    const tx = X0 + (X1 - X0) * k;
    const on = u < 0.85;
    const p = pose(tx);
    bead.setAttribute('width', Math.max(0, tx - X0));
    beam.setAttribute('x1', p.x); beam.setAttribute('y1', p.tip);
    beam.setAttribute('x2', p.x); beam.setAttribute('y2', TOP);
    beam.style.opacity = on ? 1 : 0;
    glow.setAttribute('cx', p.x); glow.setAttribute('cy', TOP);
    glow.style.opacity = on ? 0.8 + Math.random() * 0.2 : 0;
    if (on && !reduced && Math.random() < 0.6) spark(p.x);
  };

  const spark = (x) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, l = 8 + Math.random() * 18;
    s.setAttribute('x1', x); s.setAttribute('y1', TOP);
    s.setAttribute('x2', x + Math.cos(a) * l); s.setAttribute('y2', TOP + Math.sin(a) * l);
    s.setAttribute('class', 'laser__spark');
    sparks.appendChild(s);
    setTimeout(() => s.remove(), 400);
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
