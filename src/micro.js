// Corte metalográfico simulado: como a camada de cada processo se forma e como fica por dentro.
const PROC = {
  hvof:  { name: 'HVOF', kind: 'spray', pores: 0.006, oxide: 0.02, flat: 0.16, color: [150, 156, 164], stats: [['Porosidade', '< 1%'], ['Aderência', '> 70 MPa'], ['Espessura típica', '0,1–0,5 mm']], note: 'Partículas supersônicas achatam ao máximo: camada densa, quase sem poros.' },
  arc:   { name: 'Arc Spray', kind: 'spray', pores: 0.05, oxide: 0.12, flat: 0.32, color: [140, 132, 122], stats: [['Porosidade', '3–8%'], ['Aderência', '20–40 MPa'], ['Espessura típica', '0,5–3 mm']], note: 'Gotas maiores e mais óxidos entre lamelas: ótimo para recuperar medida em grandes áreas.' },
  flame: { name: 'Flame Spray', kind: 'spray', pores: 0.07, oxide: 0.08, flat: 0.38, color: [158, 150, 132], stats: [['Porosidade', '5–10%'], ['Aderência', '15–30 MPa'], ['Espessura típica', '0,3–2 mm']], note: 'Menor velocidade de partícula; com refusão, a liga autofluxante fica densa e aderida.' },
  laser: { name: 'Laser Cladding', kind: 'weld', dil: 0.04, haz: 0.12, beads: 7, color: [176, 160, 140], stats: [['Diluição', '< 5%'], ['Ligação', 'metalúrgica'], ['Espessura por passe', '0,5–2 mm']], note: 'Poça de fusão rasa: a liga quase não se mistura com o metal base e a zona afetada é mínima.' },
  pta:   { name: 'PTA', kind: 'weld', dil: 0.09, haz: 0.22, beads: 5, color: [170, 154, 134], stats: [['Diluição', '5–10%'], ['Ligação', 'metalúrgica'], ['Espessura por passe', '2–5 mm']], note: 'Cordões mais largos e espessos, com baixa diluição: ideal para impacto e abrasão severa.' },
  saw:   { name: 'Arco Submerso', kind: 'weld', dil: 0.22, haz: 0.34, beads: 4, color: [150, 146, 140], stats: [['Diluição', '15–30%'], ['Ligação', 'metalúrgica'], ['Deposição', 'muito alta']], note: 'Alta taxa de deposição para reconstruir grandes volumes, com maior mistura com o metal base.' },
};

export function initMicro(root, { reduced } = {}) {
  if (!root) return;
  const cv = root.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const btns = [...root.querySelectorAll('[data-micro]')];
  const stats = root.querySelector('[data-micro-stats]');
  const note = root.querySelector('[data-micro-note]');
  let W = 0, H = 0, DPR = 1, key = 'hvof', t = 0, raf = 0, last = 0, visible = false;
  let splats = [], grains = [];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const size = () => {
    const r = cv.getBoundingClientRect();
    DPR = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = W * DPR; cv.height = H * DPR;
    seed = 7;
    grains = Array.from({ length: Math.round(W * H / 900) }, () => [rnd() * W, rnd(), 6 + rnd() * 14, rnd()]);
    build();
  };
  const base = () => H * 0.62; // linha da interface original
  const build = () => {
    const P = PROC[key];
    seed = 11;
    splats = [];
    if (P.kind === 'spray') {
      const top = H * 0.24, n = Math.round((W / 14) * ((base() - top) / 4) * (P.flat < 0.2 ? 1.4 : 1));
      for (let i = 0; i < n; i++) {
        const w = 18 + rnd() * 34 * (P.flat / 0.2), h = 3 + rnd() * 5 * (P.flat / 0.2) * 0.6;
        splats.push({ x: rnd() * W, w, h, o: rnd() < P.oxide, p: rnd() < P.pores * 6, d: i / n });
      }
    }
  };

  const steel = (y0, y1) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, '#5d626a'); g.addColorStop(1, '#2f3236');
    ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
    // grãos do metal base
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (const [x, ry, s] of grains) {
      const y = y0 + ry * (y1 - y0);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s * 0.3); ctx.lineTo(x + s * 0.4, y + s); ctx.stroke();
    }
  };

  const draw = () => {
    const P = PROC[key];
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d0f'; ctx.fillRect(0, 0, W, H);
    const k = reduced ? 1 : Math.min(1, t / 3.2); // progresso da deposição
    const b = base();
    let pen = 0;
    if (P.kind === 'spray') {
      // perfil jateado (rugosidade de ancoragem)
      steel(b, H);
      ctx.fillStyle = '#0d0d0f';
      ctx.beginPath(); ctx.moveTo(0, b);
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, b - (Math.sin(x * 0.9) * 2 + Math.sin(x * 0.37) * 2));
      ctx.lineTo(W, b - 8); ctx.lineTo(0, b - 8); ctx.closePath(); ctx.fill();
      const [r, g, bl] = P.color;
      const top = H * 0.2, n = Math.floor(splats.length * k);
      for (let i = 0; i < n; i++) {
        const s = splats[i];
        const y = b - 2 - s.d * (b - top);
        const sh = 0.82 + ((i * 37) % 30) / 100;
        ctx.fillStyle = `rgb(${r * sh | 0},${g * sh | 0},${bl * sh | 0})`;
        ctx.beginPath(); ctx.ellipse(s.x, y, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); ctx.fill();
        if (s.o) { ctx.strokeStyle = 'rgba(30,26,22,.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x - s.w / 2, y + s.h / 2); ctx.lineTo(s.x + s.w / 2, y + s.h / 2); ctx.stroke(); }
        if (s.p) { ctx.fillStyle = '#060607'; ctx.beginPath(); ctx.arc(s.x + s.w * 0.3, y, 1 + s.h * 0.35, 0, Math.PI * 2); ctx.fill(); }
      }
      // partículas chegando
      if (k < 1) {
        const yTop = b - 2 - k * (b - top);
        for (let j = 0; j < 14; j++) {
          const x = ((j * 97 + t * 400) % W), y = ((j * 53 + t * 900) % Math.max(1, yTop));
          ctx.fillStyle = 'rgba(255,170,90,.9)'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else {
      // soldagem: cordões sobrepostos fundidos ao metal base
      const beadW = W / (P.beads * 0.62 + 0.5), bh = H * (key === 'saw' ? 0.2 : key === 'pta' ? 0.17 : 0.11);
      pen = bh * P.dil * 1.5 + 2;
      steel(b - 1, H);
      // zona termicamente afetada
      const haz = ctx.createLinearGradient(0, b, 0, b + bh * P.haz * 3);
      haz.addColorStop(0, 'rgba(255,140,60,.35)'); haz.addColorStop(1, 'rgba(255,140,60,0)');
      const done = reduced ? P.beads : Math.min(P.beads, Math.floor(t / (3.2 / P.beads)) + 1);
      ctx.fillStyle = haz; ctx.fillRect(0, b, Math.min(W, done * beadW * 0.62 + beadW * 0.5), bh * P.haz * 3);
      const [r, g, bl] = P.color;
      for (let i = 0; i < done; i++) {
        const cx = beadW * 0.5 + i * beadW * 0.62;
        const grow = reduced ? 1 : Math.min(1, (t - i * (3.2 / P.beads)) / (3.2 / P.beads));
        const gg = ctx.createLinearGradient(0, b - bh, 0, b + pen);
        gg.addColorStop(0, `rgb(${r + 30},${g + 30},${bl + 30})`); gg.addColorStop(1, `rgb(${r - 30},${g - 30},${bl - 30})`);
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.ellipse(cx, b, beadW / 2, bh * grow, 0, Math.PI, 0); ctx.ellipse(cx, b, beadW / 2, pen * grow, 0, 0, Math.PI); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, b, beadW / 2, pen * grow, 0, 0, Math.PI); ctx.stroke();
        // dendritas
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        for (let d = -3; d <= 3; d++) { ctx.beginPath(); ctx.moveTo(cx + d * beadW * 0.1, b); ctx.lineTo(cx + d * beadW * 0.07, b - bh * grow * 0.85); ctx.stroke(); }
        if (grow < 1) { const gl = ctx.createRadialGradient(cx, b - bh * grow, 0, cx, b - bh * grow, 30); gl.addColorStop(0, 'rgba(255,230,160,.95)'); gl.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - 30, b - bh * grow - 30, 60, 60); }
      }
      // linha de fusão
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,90,20,.8)';
      ctx.beginPath(); ctx.moveTo(0, b + pen * 0.6); ctx.lineTo(W, b + pen * 0.6); ctx.stroke(); ctx.setLineDash([]);
    }
    // legenda e escala
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText(P.kind === 'spray' ? 'CAMADA' : 'CORDÕES DE SOLDA', 14, 22);
    ctx.fillText('METAL BASE', 14, H - 14);
    if (P.kind === 'weld') { ctx.fillStyle = 'rgba(255,90,20,.9)'; ctx.fillText('LINHA DE FUSÃO', W - 130, b + pen * 0.6 + 16); }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(W - 84, H - 20, 60, 2); ctx.fillText('500 µm', W - 84, H - 26);
  };

  const frame = (now) => {
    t += Math.min(0.05, (now - last) / 1000 || 0); last = now;
    draw();
    raf = visible && t < 3.6 ? requestAnimationFrame(frame) : 0;
  };
  const replay = () => { t = 0; if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } else draw(); };
  const select = (k) => {
    key = k;
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.micro === k)));
    const P = PROC[k];
    stats.innerHTML = P.stats.map(([a, v]) => `<div><dt>${a}</dt><dd>${v}</dd></div>`).join('');
    note.textContent = P.note;
    build(); replay();
  };
  btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.micro)));
  new ResizeObserver(() => { size(); draw(); }).observe(cv);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) replay(); }, { threshold: 0.3 }).observe(cv);
  size(); select('hvof');
}
