// Simulação de aspersão térmica no hero.
// Um eixo gira, surge uma zona desgastada e a pistola (guiada pelo cursor ou
// em piloto automático) deposita o revestimento até recuperar o diâmetro.
// Depois vem a retífica e o ciclo recomeça em outro ponto do eixo.

const COL = 3; // largura de cada coluna do eixo (px)
// núcleos gaussianos: deposição do revestimento e espalhamento do calor
const gauss = (n, sigma) => Array.from({ length: n * 2 + 1 }, (_, k) => Math.exp(-((k - n) ** 2) / (2 * sigma * sigma)));
const COAT_K = gauss(7, 3);
const HEAT_K = gauss(10, 4.5);
const HEAT_ROWS = 28;
// rampa de corpo negro: vermelho escuro → laranja → amarelo → branco
const RAMP = [[0, 0, 0, 0], [0.18, 110, 18, 0], [0.42, 220, 60, 8], [0.66, 255, 140, 35], [0.86, 255, 210, 120], [1, 255, 248, 225]];
function rampColor(t) {
  for (let k = 1; k < RAMP.length; k++) {
    if (t <= RAMP[k][0]) {
      const a = RAMP[k - 1], b = RAMP[k];
      const u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
    }
  }
  return [255, 248, 225];
}
// cada processo tem tocha, jato e partículas próprios
const TORCHES = {
  hvof: { spread: 0.12, speed: [1150, 1650], rate: 1, width: [1.1, 1.5], spark: 0.1,
    colors: ['rgba(255,246,220,0.95)', 'rgba(255,196,100,0.85)', 'rgba(255,118,36,0.8)'],
    jet: [[255, 236, 190, 0.55], [255, 150, 60, 0.2], [255, 90, 20, 0.05]], glow: 1 },
  plasma: { spread: 0.17, speed: [850, 1250], rate: 0.9, width: [1, 1.3], spark: 0.035,
    colors: ['rgba(240,244,255,0.95)', 'rgba(200,210,255,0.85)', 'rgba(255,236,220,0.75)'],
    jet: [[220, 225, 255, 0.7], [150, 120, 255, 0.28], [255, 120, 200, 0.06]], glow: 0.7 },
  pta: { spread: 0.05, speed: [180, 260], rate: 0.45, width: [1.4, 1.8], spark: 0.06, heatMul: 2.4, hot: true,
    colors: ['rgba(255,252,240,0.95)', 'rgba(255,220,150,0.9)', 'rgba(255,170,80,0.85)'],
    jet: [[210, 230, 255, 0], [0, 0, 0, 0], [0, 0, 0, 0]], glow: 1.6 },
  arc: { spread: 0.27, speed: [620, 980], rate: 0.6, width: [2, 2.6], spark: 0.22,
    colors: ['rgba(255,250,235,0.95)', 'rgba(255,170,70,0.9)', 'rgba(230,90,30,0.85)'],
    jet: [[200, 225, 255, 0.35], [255, 160, 80, 0.1], [255, 90, 20, 0.03]], glow: 0.8 },
};
const PROCESSES = [
  { name: 'HVOF · WC-Co', torch: 'hvof' },
  { name: 'ARC SPRAY · INOX 420', torch: 'arc' },
  { name: 'HVOF · WC-CrC-Ni', torch: 'hvof' },
  { name: 'PTA · STELLITE 6', torch: 'pta' },
];
const OVER = 0.35; // sobremetal: a camada passa do diâmetro nominal para ser retificada
const C_IN = 3.0, C_DUR = 2.2, W_END = C_IN + C_DUR + 1.9; // trinca → rebaixo → entra a tocha
const G_IN = 1.9; // tempo da troca pistola → rebolo antes de retificar
const LABELS = { wear: 'DIAGNÓSTICO', spray: 'ASPERSÃO', grind: 'RETÍFICA', done: 'RECUPERADO ✓' };

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function initSpray(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduced = !!opts.reduced;
  const getBounds = opts.getBounds || (() => null);

  let W = 0, H = 0, DPR = 1, mobile = false, gutter = 16;
  let railY = 0, railA = 0, railB = 0, shaftA = 0, journal = 0;
  let cy = 0, r = 0, depth = 0, sprayLen = 0, bodyW = 0, bodyH = 0, nozzleLen = 0, bodyTop = 0, tipY = 0;
  let cols = 0, wear, target, coat, heat, polish, over;
  let zoneA = 0, zoneB = 0, zoneI0 = 0, zoneI1 = 0, zoneMM = 0.8, proc = 0;
  let phase = 'wear', phaseT = 0, sweepX = 0, progress = 0, layerMM = 0;
  let time = 0, emit = 0, emitAcc = 0, wheelA = 0;
  // troca de ferramenta: recuo (0 = trabalhando, 1 = recuada) e posição no trilho
  const cutter = { x: -999, lift: 1 }; // ferramenta de usinagem (rebaixo)
  let cracks = [], cutX = -1;
  const chips = []; // cavacos em espiral
  const tool = { gx: 0, gx0: 0, gLift: 0, wx: -999, wx0: -999, wLift: 1 };
  const grit = Array.from({ length: 70 }, () => [Math.random() * Math.PI * 2, Math.random(), Math.random()]);
  let pointerX = null, pointerT = -99, pointerUsed = reduced;
  const gun = { x: 0, vx: 0, dir: 1 };
  const parts = [];
  const sparks = [];
  let chrome, worn, coating, bead, glow, smokeSprite;
  // camadas fora da tela para desenhar a zona e o calor de forma contínua
  const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
  const [zoneCv, zoneCtx] = mk();
  const [layerCv, layerCtx] = mk();
  const [stripCv, stripCtx] = mk();
  const [heatCv, heatCtx] = mk();
  const smoke = [];
  let shaftPath = null;
  let running = false, raf = 0, last = 0, inView = true, ready = false;
  // qualidade adaptativa: aparelhos lentos recebem menos partículas e resolução menor
  let locked = false; // visitante escolheu um processo: para de alternar
  let quality = 1, dprCap = 1.75, frameCost = 8, degradeAt = 0;

  // ---------- texturas ----------
  function strip(stops, noise, scratches) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 256);
    stops.forEach(([o, col]) => lg.addColorStop(o, col));
    g.fillStyle = lg;
    g.fillRect(0, 0, 128, 256);
    if (scratches) {
      g.globalAlpha = 0.25;
      for (let i = 0; i < 60; i++) {
        g.fillStyle = Math.random() > 0.5 ? '#000' : '#8a7a6a';
        g.fillRect(0, Math.random() * 256, 128, rand(0.5, 1.5));
      }
      g.globalAlpha = 1;
    }
    if (noise) {
      const img = g.getImageData(0, 0, 128, 256);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * noise;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
    }
    return c;
  }

  function buildTextures() {
    chrome = strip([
      [0, '#16171a'], [0.07, '#4a4f56'], [0.19, '#f4f6f8'], [0.27, '#c9ced4'],
      [0.45, '#6f747b'], [0.6, '#2c2f33'], [0.78, '#8c9299'], [0.9, '#3b3e43'], [1, '#101113'],
    ], 0);
    worn = strip([
      [0, '#110e0c'], [0.1, '#3b322b'], [0.22, '#7a6a5b'], [0.32, '#5e5146'],
      [0.5, '#3a3029'], [0.7, '#2a231e'], [0.84, '#4d4137'], [1, '#0c0a09'],
    ], 38, true);
    coating = strip([
      [0, '#141312'], [0.08, '#4d4a46'], [0.2, '#aca79f'], [0.3, '#c2bdb5'],
      [0.5, '#7c7770'], [0.68, '#44413d'], [0.84, '#6b665f'], [1, '#121110'],
    ], 30);
    // cordão soldado: ondulações em arco típicas do PTA
    bead = document.createElement('canvas');
    bead.width = 512; bead.height = 256;
    const bg2 = bead.getContext('2d');
    const bgr = bg2.createLinearGradient(0, 0, 0, 256);
    [[0, '#141312'], [0.1, '#55504a'], [0.22, '#c9c2b6'], [0.32, '#a59e93'], [0.5, '#6b655d'], [0.7, '#3d3935'], [0.86, '#5f5a53'], [1, '#121110']].forEach(([o, c]) => bgr.addColorStop(o, c));
    bg2.fillStyle = bgr;
    bg2.fillRect(0, 0, 512, 256);
    bg2.lineWidth = 1.4;
    for (let x = -20; x < 540; x += 7) {
      bg2.strokeStyle = 'rgba(255,255,255,0.10)';
      bg2.beginPath();
      bg2.moveTo(x, 0);
      bg2.quadraticCurveTo(x + 10, 128, x, 256);
      bg2.stroke();
      bg2.strokeStyle = 'rgba(0,0,0,0.22)';
      bg2.beginPath();
      bg2.moveTo(x + 2, 0);
      bg2.quadraticCurveTo(x + 12, 128, x + 2, 256);
      bg2.stroke();
    }
    smokeSprite = document.createElement('canvas');
    smokeSprite.width = smokeSprite.height = 64;
    const sgc = smokeSprite.getContext('2d');
    const srg = sgc.createRadialGradient(32, 32, 0, 32, 32, 32);
    srg.addColorStop(0, 'rgba(180,176,170,0.5)');
    srg.addColorStop(1, 'rgba(180,176,170,0)');
    sgc.fillStyle = srg;
    sgc.fillRect(0, 0, 64, 64);
    glow = document.createElement('canvas');
    glow.width = glow.height = 128;
    const g = glow.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,240,200,1)');
    rg.addColorStop(0.18, 'rgba(255,170,70,0.75)');
    rg.addColorStop(0.45, 'rgba(255,90,20,0.25)');
    rg.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
  }

  // ---------- layout ----------
  function layout() {
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    if (!W || !H) return;
    DPR = Math.min(window.devicePixelRatio || 1, W < 900 ? Math.min(dprCap, 1.5) : dprCap);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    mobile = W < 900;
    gutter = clamp(W * 0.04, 16, 56);

    const b = getBounds() || { floor: H * 0.86, contentRight: W * 0.5, contentTop: H * 0.4, header: 76 };
    // no mobile o equipamento ocupa a faixa acima do título
    const floor = mobile ? b.contentTop - 18 : b.floor;

    if (mobile) {
      r = clamp(W * 0.085, 28, 40);
      bodyW = 40; bodyH = 56; nozzleLen = 22;
      railY = b.header + 66; // espaço para os botões de processo acima do trilho
      railA = gutter; railB = W - gutter;
      shaftA = -40; journal = 0;
    } else {
      r = clamp(H * 0.075, 46, 80);
      bodyW = 58; bodyH = 84; nozzleLen = 36;
      railY = b.header + 92; // abaixo dos botões de processo
      railA = Math.min(b.contentRight + 56, W - 340);
      railB = W - gutter;
      shaftA = railA - 30;
      journal = r * 1.1;
    }
    cy = floor - r - (mobile ? 12 : 44);
    depth = r * 0.17;
    const room = cy - r - railY - 24 - bodyH - nozzleLen;
    sprayLen = clamp(Math.min(room, mobile ? 110 : H * 0.21), 40, 230);
    tipY = cy - r - sprayLen;
    bodyTop = tipY - nozzleLen - bodyH;

    cols = Math.ceil(W / COL) + 2;
    wear = new Float32Array(cols);
    target = new Float32Array(cols);
    coat = new Float32Array(cols);
    heat = new Float32Array(cols);
    polish = new Float32Array(cols);
    over = new Float32Array(cols);
    parts.length = 0;
    sparks.length = 0;
    gun.x = railA + (railB - railA) * 0.6;
    newZone();
    ready = true;
  }

  function newZone() {
    const minX = Math.max(shaftA + 40, railA + bodyW);
    const maxX = railB - bodyW;
    const wz = clamp((maxX - minX) * rand(0.35, 0.55), mobile ? 90 : 140, mobile ? 180 : 300);
    zoneA = rand(minX, Math.max(minX, maxX - wz));
    zoneB = zoneA + wz;
    zoneI0 = Math.floor(zoneA / COL);
    zoneI1 = Math.min(cols - 1, Math.ceil(zoneB / COL));
    for (let i = 0; i < cols; i++) { wear[i] = 0; target[i] = 0; coat[i] = 0; polish[i] = 0; over[i] = 0; }
    for (let i = zoneI0; i <= zoneI1; i++) {
      const u = (i - zoneI0) / Math.max(1, zoneI1 - zoneI0);
      const edge = Math.min(1, Math.sin(Math.PI * u) * 1.6);
      target[i] = Math.pow(Math.max(0, edge), 0.7) * rand(0.9, 1);
      over[i] = OVER * Math.pow(Math.sin(Math.PI * u), 0.35);
    }
    zoneMM = Math.round(rand(0.5, 1.2) * 100) / 100;
    // trincas na superfície: ramificações a partir de pontos na zona
    cracks = [];
    const nC = 3 + Math.floor(rand(0, 3));
    for (let c = 0; c < nC; c++) {
      let x = rand(zoneA + 10, zoneB - 10), y = 0.08 + rand(0, 0.15);
      const pts = [[x, y]], len = 6 + Math.floor(rand(0, 6));
      for (let k = 0; k < len; k++) { x += rand(-9, 9); y += rand(0.04, 0.1); pts.push([x, y]); }
      cracks.push({ pts, at: rand(0.4, 1.4), br: pts.length > 4 ? { from: 2 + Math.floor(rand(0, 2)), dx: rand(-1, 1) > 0 ? 1 : -1 } : null });
    }
    cutX = -1;
    if (!locked) proc = (proc + 1) % PROCESSES.length;
    opts.onProcess?.(PROCESSES[proc].torch);
    canvas.dataset.process = PROCESSES[proc].torch;
    phase = 'wear';
    phaseT = 0;
    progress = 0;
  }

  const ptaGap = () => (mobile ? 10 : 14);
  const tipFor = (type) => (type === 'pta' ? cy - r - ptaGap() : tipY);
  const radiusAt = (i) => (i >= 0 && i < cols ? r - (wear[i] - coat[i]) * depth : r);
  const onShaft = (x) => x >= (mobile ? -40 : shaftA) && x <= W + 40;

  // ---------- simulação ----------
  function update(dt) {
    time += dt;
    phaseT += dt;
    const steering = time - pointerT < 2.5 && pointerX !== null;

    // máquina de estados
    if (phase === 'wear') {
      // trinca e quebra: um fragmento se solta
      if (phaseT > 1.7 && phaseT - dt <= 1.7) {
        const c = cracks[0];
        if (c) {
          const x0 = c.pts[0][0];
          // a trinca não remove material: só solta faíscas e poeira
          for (let k = 0; k < 10; k++) spawnSpark(x0 + rand(-8, 8), cy - r + 2, false);
          for (let k = 0; k < 5; k++) smoke.push({ x: x0, y: cy - r, vx: rand(-20, 20), vy: rand(-40, -15), life: 0, max: rand(0.8, 1.4), size: rand(6, 12) });
        }
      }
      // usinagem: a ferramenta rebaixa a zona até a profundidade de recuperação
      if (phaseT > C_IN && phaseT < C_IN + C_DUR) {
        const k = easeInOut((phaseT - C_IN) / C_DUR);
        cutX = zoneA - 6 + (zoneB - zoneA + 12) * k;
        for (let i = zoneI0; i <= zoneI1; i++) if (i * COL < cutX) wear[i] = Math.max(wear[i], target[i]);
        const ci = clamp(Math.floor(cutX / COL), 0, cols - 1);
        if (chips.length < 22 && Math.random() < 0.16) chips.push({ x: cutX + 4, y: cy - r + target[ci] * depth, vx: rand(-60, 40), vy: rand(-260, -140), a: rand(0, 6.28), va: rand(-6, 6), r: rand(8, 13), turns: rand(3, 5), life: 0, max: rand(0.9, 1.5), hue: Math.random() });
      } else if (phaseT >= C_IN + C_DUR) {
        for (let i = zoneI0; i <= zoneI1; i++) wear[i] = target[i];
        cutX = zoneB + 20;
      }
      if (phaseT > W_END) { phase = 'spray'; phaseT = 0; }
    } else if (phase === 'spray') {
      let sw = 0, sc = 0;
      for (let i = zoneI0; i <= zoneI1; i++) { sw += wear[i] + over[i]; sc += coat[i]; }
      progress = sw ? sc / sw : 1;
      if (progress > 0.985) {
        for (let i = zoneI0; i <= zoneI1; i++) coat[i] = wear[i] + over[i];
        progress = 1; phase = 'grind'; phaseT = 0; sweepX = zoneA - 10;
      }
    } else if (phase === 'grind') {
      // a pistola sai de cena e o rebolo desce antes de varrer a zona
      const k = easeInOut(clamp((phaseT - G_IN) / 1.8, 0, 1));
      sweepX = zoneA - 10 + (zoneB - zoneA + 20) * k;
      if (phaseT > G_IN) {
        for (let i = zoneI0; i <= zoneI1; i++) {
          if (i * COL < sweepX) { polish[i] = Math.min(1, polish[i] + dt * 5); coat[i] = wear[i]; }
        }
        if (Math.random() < 0.9) spawnSpark(sweepX, cy - r + rand(0, 6), true);
      }
      if (phaseT > G_IN + 1.9) { phase = 'done'; phaseT = 0; }
    } else if (phase === 'done' && phaseT > 1.8) {
      newZone();
    }

    wheelA += dt * 28;

    // cavacos: sobem, giram e caem com a gravidade
    for (let k = chips.length - 1; k >= 0; k--) {
      const c = chips[k];
      c.life += dt; c.vy += 520 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.va * dt;
      if (c.life > c.max || c.y > cy + r + 30) chips.splice(k, 1);
    }

    // pistola
    const minG = railA + bodyW * 0.7, maxG = railB - bodyW * 0.7;
    let tx;
    if (steering) {
      pointerUsed = true;
      tx = clamp(pointerX, minG, maxG);
    } else if (phase === 'spray') {
      const speed = (mobile ? 120 : 170) * (PROCESSES[proc].torch === 'pta' ? 0.55 : 1);
      tx = gun.x + gun.dir * speed * dt;
      if (tx > zoneB + 12) gun.dir = -1;
      if (tx < zoneA - 12) gun.dir = 1;
    } else {
      tx = phase === 'wear' ? zoneA : gun.x;
    }
    tx = clamp(tx, minG, maxG);
    const nx = steering || phase !== 'spray' ? gun.x + (tx - gun.x) * (1 - Math.exp(-7 * dt)) : tx;
    gun.vx = (nx - gun.x) / Math.max(dt, 1e-4);
    gun.x = nx;
    toolChange();

    // emissão
    const wantEmit = phase === 'spray' ? 1 : 0;
    emit += (wantEmit - emit) * (1 - Math.exp(-10 * dt));
    const T = TORCHES[PROCESSES[proc].torch];
    const rate = (mobile ? 380 : 720) * emit * quality * T.rate;
    emitAcc += rate * dt;
    const spread = T.spread;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      const a = rand(-spread, spread) * (Math.random() < 0.8 ? 0.6 : 1);
      const sp = rand(T.speed[0], T.speed[1]) * (sprayLen / 200 + 0.4);
      const ox = T === TORCHES.arc ? rand(-3, 3) : rand(-1.5, 1.5);
      const ty = tipFor(PROCESSES[proc].torch);
      parts.push({ x: gun.x + ox, y: ty + 2, vx: Math.sin(a) * sp + gun.vx * 0.25, vy: Math.cos(a) * sp, y0: ty });
    }

    // partículas
    for (let n = parts.length - 1; n >= 0; n--) {
      const p = parts[n];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const i = Math.floor(p.x / COL);
      if (onShaft(p.x) && p.y >= cy - radiusAt(i)) {
        impact(i, p);
        parts[n] = parts[parts.length - 1];
        parts.pop();
      } else if (p.y > H + 20) {
        parts[n] = parts[parts.length - 1];
        parts.pop();
      }
    }

    // faíscas
    for (let n = sparks.length - 1; n >= 0; n--) {
      const s = sparks[n];
      s.life -= dt;
      s.vy += 1500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.y > cy + r + 60) {
        sparks[n] = sparks[sparks.length - 1];
        sparks.pop();
      }
    }

    // calor: difusão + resfriamento
    const decay = Math.exp(-0.85 * dt);
    for (let pass = 0; pass < 2; pass++) {
      let prev = heat[0];
      for (let i = 1; i < cols - 1; i++) {
        const cur = heat[i];
        heat[i] = cur * 0.6 + (prev + heat[i + 1]) * 0.2;
        prev = cur;
      }
    }
    for (let i = 0; i < cols; i++) heat[i] *= decay;

    // fumaça
    for (let n = smoke.length - 1; n >= 0; n--) {
      const m = smoke[n];
      m.life += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= 0.99;
      if (m.life > m.max) {
        smoke[n] = smoke[smoke.length - 1];
        smoke.pop();
      }
    }

    // leituras
    let sc = 0, n = 0;
    for (let i = zoneI0; i <= zoneI1; i++) { sc += coat[i]; n++; }
    layerMM = n ? (sc / n) * zoneMM * 1.35 : 0;
  }

  function impact(i, p) {
    if (phase === 'spray') {
      const n = (COAT_K.length - 1) / 2;
      for (let d = -n; d <= n; d++) {
        const j = i + d;
        if (j < 0 || j >= cols) continue;
        const room = wear[j] + over[j] - coat[j];
        if (room > 0) coat[j] += Math.min(room, 0.0053 * COAT_K[d + n]);
      }
    }
    const n = (HEAT_K.length - 1) / 2;
    for (let d = -n; d <= n; d++) {
      const j = i + d;
      if (j >= 0 && j < cols) heat[j] = Math.min(1, heat[j] + 0.012 * (TORCHES[PROCESSES[proc].torch].heatMul || 1) * HEAT_K[d + n]);
    }
    if (Math.random() < TORCHES[PROCESSES[proc].torch].spark) spawnSpark(p.x, p.y, false);
    if (Math.random() < 0.025 && smoke.length < 60) {
      smoke.push({ x: p.x + rand(-6, 6), y: p.y - 4, vx: rand(-12, 12), vy: rand(-55, -30), life: 0, max: rand(1.4, 2.4), size: rand(14, 22) });
    }
  }

  function spawnSpark(x, y, grind) {
    if (sparks.length > 260) return;
    sparks.push({
      x, y,
      vx: grind ? rand(-420, -60) : rand(-380, 380),
      vy: grind ? rand(-420, -120) : rand(-520, -140),
      life: rand(0.25, grind ? 0.55 : 0.8),
      max: 0.8,
    });
  }

  // ---------- desenho ----------
  function drawRail() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(railA, railY + 0.5);
    ctx.lineTo(railB, railY + 0.5);
    ctx.moveTo(railA + 0.5, railY - 8);
    ctx.lineTo(railA + 0.5, railY + 8);
    ctx.moveTo(railB - 0.5, railY - 8);
    ctx.lineTo(railB - 0.5, railY + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0, k = 0; railA + x <= railB; x += 10, k++) {
      const h = k % 10 === 0 ? 7 : k % 5 === 0 ? 4 : 2;
      ctx.moveTo(railA + x + 0.5, railY - h);
      ctx.lineTo(railA + x + 0.5, railY);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '400 9px "JetBrains Mono", ui-monospace, monospace';
    for (let x = 0; railA + x <= railB - 20; x += mobile ? 200 : 100) {
      ctx.fillText(String(x).padStart(3, '0'), railA + x + 3, railY - 10);
    }
    ctx.restore();
  }

  function drawShaft() {
    const x0 = mobile ? -40 : shaftA;
    const zA = zoneI0 * COL;
    const zB = (zoneI1 + 1) * COL;

    // sombra suave no piso
    const half = (W - x0 + journal) / 2 + 60;
    ctx.save();
    ctx.translate(x0 - journal + half - 60, cy + r + 14);
    ctx.scale(half / 30, 1);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    sg.addColorStop(0, 'rgba(0,0,0,0.6)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(-30, -30, 60, 60);
    ctx.restore();

    // vista lateral realista: placa do torno segurando o colo, com escalonamento chanfrado
    if (!mobile) {
      const jr = r * 0.62;
      const jx = x0 - journal;
      const ch = r * 0.12; // chanfro
      // colo (diâmetro menor)
      ctx.drawImage(chrome, 0, 0, 1, 256, jx, cy - jr, journal + 1, jr * 2);
      // ressalto chanfrado entre colo e corpo
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0 - ch, cy - jr);
      ctx.lineTo(x0, cy - r);
      ctx.lineTo(x0, cy + r);
      ctx.lineTo(x0 - ch, cy + jr);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(chrome, 0, 0, 1, 256, x0 - ch, cy - r, ch + 1, r * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x0 - ch, cy - r, ch, r * 2);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, cy - r); ctx.lineTo(x0, cy + r);
      ctx.stroke();
      // placa do torno (3 castanhas) — as castanhas giram com o eixo
      const cw = r * 0.9, chh = r * 2.3;
      const cx0 = jx - cw;
      const pg = ctx.createLinearGradient(0, cy - chh / 2, 0, cy + chh / 2);
      pg.addColorStop(0, '#1a1b1e'); pg.addColorStop(0.25, '#4a4e55'); pg.addColorStop(0.5, '#2a2c30'); pg.addColorStop(0.8, '#3b3e44'); pg.addColorStop(1, '#141517');
      ctx.fillStyle = pg;
      roundRect(cx0 - r * 0.5, cy - chh / 2, cw * 0.7 + r * 0.5, chh, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(cx0 + cw * 0.2, cy - chh / 2 + 4); ctx.lineTo(cx0 + cw * 0.2, cy + chh / 2 - 4);
      ctx.stroke();
      // 3 castanhas girando com o eixo (120° entre si): as de trás passam por trás do colo
      const jawW = cw * 0.75, jawH = r * 0.34, jawT = r * 0.42, jx0 = cx0 + cw * 0.7;
      const spin = time * 2.4;
      const jaws = [0, 1, 2].map((i) => spin + (i * Math.PI * 2) / 3);
      const drawJaw = (a) => {
        const c = Math.cos(a), sn = Math.sin(a);
        const yi = cy - jr * c, yo = cy - (jr + jawH) * c;
        const half = (jawT / 2) * Math.abs(sn);
        const y0 = Math.min(yi, yo) - half, y1 = Math.max(yi, yo) + half;
        const lit = 0.35 + 0.65 * Math.max(0, sn) * (0.6 + 0.4 * Math.max(0, c));
        const jg = ctx.createLinearGradient(0, y0, 0, y1);
        const v = (k) => Math.round(28 + 120 * lit * k);
        jg.addColorStop(0, `rgb(${v(1)},${v(1.02)},${v(1.06)})`);
        jg.addColorStop(1, `rgb(${v(0.45)},${v(0.46)},${v(0.5)})`);
        ctx.fillStyle = jg;
        ctx.fillRect(jx0, y0, jawW, Math.max(1, y1 - y0));
        // serrilhado da castanha
        ctx.fillStyle = `rgba(0,0,0,${0.25 + 0.2 * lit})`;
        for (let k = 1; k < 4; k++) ctx.fillRect(jx0 + (jawW / 4) * k, y0 + 1, 1, Math.max(0, y1 - y0 - 2));
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(jx0 + 0.5, y0 + 0.5, jawW - 1, Math.max(0, y1 - y0 - 1));
      };
      jaws.filter((a) => Math.sin(a) < 0).forEach(drawJaw);
      // o colo cobre as castanhas que estão atrás
      ctx.drawImage(chrome, 0, 0, 1, 256, jx0, cy - jr, jawW, jr * 2);
      jaws.filter((a) => Math.sin(a) >= 0).forEach(drawJaw);
      // reflexo que percorre a placa, sugerindo rotação
      const sweep = (Math.sin(time * 2.4) * 0.5 + 0.5) * chh;
      const sg2 = ctx.createLinearGradient(0, cy - chh / 2 + sweep - 30, 0, cy - chh / 2 + sweep + 30);
      sg2.addColorStop(0, 'rgba(255,255,255,0)'); sg2.addColorStop(0.5, 'rgba(255,255,255,0.08)'); sg2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg2;
      ctx.fillRect(cx0 - r * 0.5, cy - chh / 2, cw * 0.7 + r * 0.5, chh);
      ctx.globalAlpha = 1;
    }

    // trechos íntegros
    ctx.drawImage(chrome, 0, 0, 1, 256, x0, cy - r, Math.max(0, zA - x0), r * 2);
    ctx.drawImage(chrome, 0, 0, 1, 256, zB, cy - r, W - zB + 40, r * 2);

    // contorno real do eixo (o diâmetro muda na zona desgastada)
    shaftPath = new Path2D();
    shaftPath.moveTo(x0, cy - r);
    for (let i = Math.max(0, Math.floor(x0 / COL)); i < cols; i += 2) shaftPath.lineTo(i * COL, cy - radiusAt(i));
    shaftPath.lineTo(W + 40, cy - r);
    shaftPath.lineTo(W + 40, cy + r);
    for (let i = cols - 1; i >= Math.max(0, Math.floor(x0 / COL)); i -= 2) shaftPath.lineTo(i * COL, cy + radiusAt(i));
    shaftPath.lineTo(x0, cy + r);
    shaftPath.closePath();

    // zona de trabalho: texturas contínuas mascaradas pela proporção de cada camada
    const zw = Math.max(1, Math.round(zB - zA));
    // margem para o sobremetal, que fica acima do diâmetro nominal
    const om = Math.ceil(OVER * depth) + 2;
    const zh = Math.max(1, Math.round(r * 2 + om * 2));
    if (zoneCv.width !== zw || zoneCv.height !== zh) {
      zoneCv.width = layerCv.width = zw;
      zoneCv.height = layerCv.height = zh;
    }
    const n = zoneI1 - zoneI0 + 1;
    if (stripCv.width !== n) { stripCv.width = n; stripCv.height = 1; }
    const strip = stripCtx.createImageData(n, 1);
    const layer = (tex, alphaAt, lit = false) => {
      for (let k = 0; k < n; k++) strip.data[k * 4 + 3] = clamp(alphaAt(zoneI0 + k), 0, 1) * 255;
      stripCtx.putImageData(strip, 0, 0);
      layerCtx.globalCompositeOperation = 'source-over';
      layerCtx.clearRect(0, 0, zw, zh);
      layerCtx.drawImage(tex, 0, 0, tex.width, 256, 0, 0, zw, zh);
      // luz do cilindro: o mesmo brilho/sombra do cromo modela a camada
      if (lit) {
        layerCtx.globalCompositeOperation = 'overlay';
        layerCtx.drawImage(chrome, 0, 0, 1, 256, 0, om, zw, zh - om * 2);
      }
      layerCtx.globalCompositeOperation = 'destination-in';
      layerCtx.imageSmoothingEnabled = true;
      layerCtx.drawImage(stripCv, 0, 0, n, 1, 0, 0, zw, zh);
      zoneCtx.drawImage(layerCv, 0, 0);
    };
    zoneCtx.clearRect(0, 0, zw, zh);
    zoneCtx.drawImage(chrome, 0, 0, 1, 256, 0, om, zw, zh - om * 2);
    layer(worn, (i) => Math.min(1, wear[i] * 6) * (1 - polish[i]));
    layer(PROCESSES[proc].torch === 'pta' ? bead : coating, (i) => (wear[i] > 0.01 ? Math.min(1, coat[i] / wear[i]) : coat[i] > 0.01 ? 1 : 0) * (1 - polish[i]), true);
    ctx.save();
    ctx.clip(shaftPath);
    ctx.drawImage(zoneCv, zA, cy - r - om);
    ctx.restore();

    // linhas de giro
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, cy - r, W - x0 + 40, r * 2);
    ctx.clip();
    for (let k = 0; k < 12; k++) {
      const phi = ((k / 12) * Math.PI * 2 + time * 2.4) % (Math.PI * 2);
      if (phi > Math.PI) continue;
      const y = cy - r * Math.cos(phi);
      ctx.fillStyle = `rgba(255,255,255,${0.07 * Math.sin(phi)})`;
      ctx.fillRect(x0, y, W - x0 + 40, 1);
    }
    ctx.restore();

    // arestas
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, cy - r + 0.5);
    for (let i = Math.max(0, Math.floor(x0 / COL)); i < cols; i += 2) ctx.lineTo(i * COL, cy - radiusAt(i) + 0.5);
    ctx.stroke();
  }

  function endCap(x, rr, shoulder) {
    ctx.save();
    const g = ctx.createLinearGradient(x - rr * 0.3, 0, x + rr * 0.3, 0);
    g.addColorStop(0, shoulder ? '#2a2c30' : '#9aa0a7');
    g.addColorStop(1, shoulder ? '#6d7279' : '#3a3d42');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, cy, rr * 0.22, rr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    ctx.restore();
  }

  function drawHeat() {
    let max = 0;
    for (let i = 0; i < cols; i++) if (heat[i] > max) max = heat[i];
    if (max < 0.015 || !shaftPath) return;
    if (heatCv.width !== cols) { heatCv.width = cols; heatCv.height = HEAT_ROWS; }
    const img = heatCtx.createImageData(cols, HEAT_ROWS);
    const d = img.data;
    for (let y = 0; y < HEAT_ROWS; y++) {
      const t = y / (HEAT_ROWS - 1);
      // mais quente na faixa superior (onde o jato bate), esfriando suavemente para baixo
      const prof = 0.28 + 0.72 * Math.exp(-(((t - 0.2) / 0.3) ** 2));
      for (let i = 0; i < cols; i++) {
        const h = heat[i] * prof;
        if (h < 0.01) continue;
        const [cr, cg, cb] = rampColor(Math.min(1, h * 1.15));
        const o = (y * cols + i) * 4;
        d[o] = cr; d[o + 1] = cg; d[o + 2] = cb;
        d[o + 3] = Math.min(1, h * 1.4) * 235;
      }
    }
    heatCtx.putImageData(img, 0, 0);
    ctx.save();
    ctx.clip(shaftPath);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    const om = Math.ceil(OVER * depth) + 2; // cobre o sobremetal acima do diâmetro
    ctx.drawImage(heatCv, 0, 0, cols, HEAT_ROWS, 0, cy - r - om, cols * COL, r * 2 + om * 2);
    ctx.restore();
  }

  function drawSmoke() {
    if (!smoke.length) return;
    // fumaça clara: 'screen' nunca escurece o que está atrás (sem mancha preta)
    ctx.globalCompositeOperation = 'screen';
    for (const m of smoke) {
      const u = m.life / m.max;
      const sz = m.size * (1 + u * 2.2);
      ctx.globalAlpha = 0.22 * Math.sin(Math.PI * u);
      ctx.drawImage(smokeSprite, m.x - sz / 2, m.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSprayFx() {
    ctx.globalCompositeOperation = 'lighter';
    const surf = cy - r;

    const T = TORCHES[PROCESSES[proc].torch];
    const type = PROCESSES[proc].torch;
    if (emit > 0.02) {
      // jato
      const half = Math.tan(T.spread) * sprayLen * 0.7;
      const g = ctx.createLinearGradient(0, tipY, 0, surf);
      T.jet.forEach(([cr, cg, cb, ca], i) => g.addColorStop([0, 0.35, 1][i], `rgba(${cr},${cg},${cb},${ca * emit})`));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(gun.x - 3, tipY);
      ctx.lineTo(gun.x + 3, tipY);
      ctx.lineTo(gun.x + half, surf);
      ctx.lineTo(gun.x - half, surf);
      ctx.closePath();
      ctx.fill();
      if (type === 'pta') {
        // arco transferido: coluna de plasma da tocha até a peça + poça de fusão
        const top = tipFor('pta');
        const surfY = cy - r;
        const w = 4 + Math.random() * 1.5;
        const ag = ctx.createLinearGradient(0, top, 0, surfY);
        ag.addColorStop(0, `rgba(255,255,255,${0.95 * emit})`);
        ag.addColorStop(0.5, `rgba(190,215,255,${0.85 * emit})`);
        ag.addColorStop(1, `rgba(255,240,210,${0.95 * emit})`);
        ctx.fillStyle = ag;
        ctx.beginPath();
        ctx.moveTo(gun.x - 2, top);
        ctx.lineTo(gun.x + 2, top);
        ctx.lineTo(gun.x + w, surfY);
        ctx.lineTo(gun.x - w, surfY);
        ctx.closePath();
        ctx.fill();
        const pool = (mobile ? 50 : 80) * (0.92 + Math.random() * 0.12);
        ctx.globalAlpha = emit;
        ctx.drawImage(glow, gun.x - pool / 2, surfY - pool / 2, pool, pool);
        ctx.globalAlpha = 1;
        ctx.fillStyle = `rgba(255,250,235,${0.9 * emit})`;
        ctx.beginPath();
        ctx.ellipse(gun.x, surfY + 1, 7, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'hvof') {
        // diamantes de choque supersônicos
        for (let k = 0; k < 5; k++) {
          const y = tipY + 8 + k * 10;
          if (y > surf) break;
          ctx.fillStyle = `rgba(255,240,210,${(0.6 - k * 0.11) * emit})`;
          ctx.beginPath();
          ctx.ellipse(gun.x, y, 2.4 - k * 0.2, 4.4, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (type === 'plasma') {
        // núcleo de plasma: coluna violeta tremulante
        const len = Math.min(sprayLen * 0.45, 70) * (0.9 + Math.random() * 0.15);
        const pg = ctx.createLinearGradient(0, tipY, 0, tipY + len);
        pg.addColorStop(0, `rgba(255,255,255,${0.95 * emit})`);
        pg.addColorStop(0.3, `rgba(170,150,255,${0.7 * emit})`);
        pg.addColorStop(1, 'rgba(120,80,255,0)');
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.ellipse(gun.x, tipY + len / 2, 5 + Math.random(), len / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // arco elétrico entre os dois arames
        ctx.strokeStyle = `rgba(200,225,255,${0.9 * emit})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gun.x - 4, tipY + 1);
        for (let k = 1; k <= 4; k++) ctx.lineTo(gun.x - 4 + k * 2, tipY + 1 + rand(-2.5, 2.5));
        ctx.stroke();
        if (Math.random() < 0.5) {
          const s2 = 30 + Math.random() * 30;
          ctx.globalAlpha = 0.6 * emit;
          ctx.drawImage(glow, gun.x - s2 / 2, tipY - s2 / 2 + 2, s2, s2);
          ctx.globalAlpha = 1;
        }
      }
      // brilho no impacto
      const s = (mobile ? 110 : 170) * (0.9 + Math.sin(time * 40) * 0.05);
      ctx.globalAlpha = 0.85 * emit * T.glow;
      ctx.drawImage(glow, gun.x - s / 2, surf - s / 2, s, s);
      ctx.globalAlpha = 1;
    }

    // partículas agrupadas por temperatura
    const k = 0.011;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      for (let n = 0; n < parts.length; n++) {
        const p = parts[n];
        const f = (p.y - p.y0) / Math.max(1, surf - p.y0);
        const bucket = f < 0.3 ? 0 : f < 0.65 ? 1 : 2;
        if (bucket !== b) continue;
        ctx.moveTo(p.x - p.vx * k, p.y - p.vy * k);
        ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = T.colors[b];
      ctx.lineWidth = b === 0 ? T.width[0] : T.width[1];
      ctx.stroke();
    }

    // faíscas
    [['rgba(255,236,180,0.95)', (s) => s.life > 0.35], ['rgba(240,110,40,0.75)', (s) => s.life <= 0.35]].forEach(([col, test]) => {
      ctx.beginPath();
      for (let n = 0; n < sparks.length; n++) {
        const s = sparks[n];
        if (!test(s)) continue;
        ctx.moveTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
        ctx.lineTo(s.x, s.y);
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // retífica
    if (phase === 'grind' && phaseT > G_IN) {
      const g = ctx.createLinearGradient(sweepX - 30, 0, sweepX + 6, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(sweepX - 30, cy - r, 36, r * 2);
      const s = 90 * clamp((phaseT - 0.6) * 3, 0, 1);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glow, sweepX - s / 2, cy - r - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // sequência real: recua, corre para fora do trilho; a outra entra recuada e avança
  function toolChange() {
    const seg = (a, b) => easeInOut(clamp((phaseT - a) / (b - a), 0, 1));
    const offR = railB + 40, offL = railA - 40, wStart = zoneA - 10;
    if (phase === 'grind') {
      tool.gLift = seg(0, 0.45);
      gun.x = tool.gx = tool.gx0 + (offR - tool.gx0) * seg(0.45, 1.05);
      tool.wx = phaseT < G_IN ? offL + (wStart - offL) * seg(0.75, 1.4) : sweepX;
      tool.wLift = 1 - seg(1.4, G_IN);
    } else if (phase === 'done') {
      tool.gLift = 1; tool.wLift = 0; tool.wx = sweepX; gun.x = tool.gx;
    } else if (phase === 'wear') {
      tool.wLift = Math.max(tool.wLift, seg(0, 0.4));
      tool.wx = tool.wx0 < railA - 100 ? -999 : tool.wx0 + (offR - tool.wx0) * seg(0.4, 1.0);
      // ferramenta de usinagem: entra recuada, desce, rebaixa e sai pelo fim da régua
      if (phaseT < C_IN) { cutter.x = offL + (zoneA - 6 - offL) * seg(2.0, 2.6); cutter.lift = 1 - seg(2.6, C_IN); }
      else if (phaseT < C_IN + C_DUR) { cutter.x = cutX; cutter.lift = 0; }
      else { cutter.lift = seg(C_IN + C_DUR, C_IN + C_DUR + 0.35); cutter.x = (zoneB + 6) + (offR - zoneB - 6) * seg(C_IN + C_DUR + 0.35, C_IN + C_DUR + 0.95); }
      const g0 = C_IN + C_DUR + 0.7;
      gun.x = tool.gx = offL + (zoneA - offL) * seg(g0, g0 + 0.6);
      tool.gLift = 1 - seg(g0 + 0.6, g0 + 1.1);
    } else {
      cutter.x = -999;
      tool.gx0 = tool.gx = gun.x; tool.gLift = 0;
      tool.wx0 = tool.wx; tool.wLift = 1;
    }
    if (phase !== 'wear') tool.wx0 = tool.wx;
    if (phase !== 'grind') tool.gx0 = tool.gx;
  }

  // a ferramenta aparece/some nas pontas da régua
  const railFade = (x) => clamp(Math.min(x - (railA - 40), railB + 40 - x) / 40, 0, 1);

  function drawCracks() {
    if (phase !== 'wear' || !cracks.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of cracks) {
      const grow = clamp((phaseT - c.at) / 0.8, 0, 1);
      if (grow <= 0) continue;
      const n = Math.max(2, Math.ceil(c.pts.length * grow));
      const draw = (pts, w) => {
        ctx.beginPath();
        pts.forEach(([x, y], k) => { const yy = cy - r + y * r * 1.2; if (k) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); });
        ctx.lineWidth = w; ctx.stroke();
      };
      // corte da ferramenta remove a trinca
      ctx.save();
      if (cutX > 0) { ctx.beginPath(); ctx.rect(cutX, 0, W, H); ctx.clip(); }
      const pts = c.pts.slice(0, n);
      ctx.strokeStyle = 'rgba(0,0,0,.75)'; draw(pts, 2.2);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.save(); ctx.translate(0.8, 0.8); draw(pts, 0.8); ctx.restore();
      if (c.br && n > c.br.from + 1) {
        const [bx, by] = c.pts[c.br.from];
        ctx.strokeStyle = 'rgba(0,0,0,.6)';
        draw([[bx, by], [bx + c.br.dx * 8, by + 0.08], [bx + c.br.dx * 13, by + 0.17]], 1.4);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // cavaco helicoidal visto de lado: uma mola de fita metálica que se desenrola
  function drawChips() {
    if (!chips.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of chips) {
      const fade = 1 - clamp((c.life - c.max * 0.7) / (c.max * 0.3), 0, 1);
      const L = c.r * 2.4, amp = c.r * 0.55, n = 36;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.a);
      const path = (front) => {
        ctx.beginPath();
        let started = false;
        for (let k = 0; k <= n; k++) {
          const t = k / n, ph = t * c.turns * Math.PI * 2;
          const isFront = Math.cos(ph) > 0;
          const px = (t - 0.5) * L, py = Math.sin(ph) * amp * (0.6 + 0.4 * t);
          if (isFront === front) { if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; } }
          else started = false;
        }
      };
      const warm = c.hue < 0.5;
      // parte de trás da espira (mais escura) e da frente (com brilho)
      ctx.globalAlpha = fade * 0.8;
      ctx.strokeStyle = warm ? '#6e5626' : '#3c4c6e'; ctx.lineWidth = 2.6; path(false); ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = warm ? '#d8b56a' : '#8fa6d4'; ctx.lineWidth = 2.6; path(true); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; path(true); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCutter() {
    const fa = railFade(cutter.x);
    if (fa <= 0 || phase !== 'wear') return;
    const x = cutter.x;
    const ci = clamp(Math.floor(x / COL), 0, cols - 1);
    const work = cy - r + (target[ci] || 0) * depth; // ponta no fundo do rebaixo
    const S0 = mobile ? 0.9 : 1.15;
    const park = railY + 16 + (34 + 9 + 46) * S0;
    const tip = work - (work - park) * easeInOut(cutter.lift);
    ctx.save(); ctx.globalAlpha = fa;
    // carro e coluna
    ctx.fillStyle = '#26282c'; roundRect(x - 26, railY - 7, 52, 14, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
    // cabeçote de fresamento: motor do spindle, porca de fixação e fresa de topo helicoidal girando
    const S = mobile ? 0.9 : 1.15;
    const fl = 34 * S, fw = 22 * S;            // comprimento e diâmetro da fresa
    const nutH = 9 * S, headH = 46 * S, headW = 52 * S;
    const headTop = tip - fl - nutH - headH;
    const hg = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    hg.addColorStop(0, '#1c1d20'); hg.addColorStop(0.5, '#70757c'); hg.addColorStop(1, '#1c1d20');
    ctx.fillStyle = hg; ctx.fillRect(x - 5, railY + 7, 10, Math.max(0, headTop - railY - 7));
    // motor do spindle
    const mg = ctx.createLinearGradient(x - headW / 2, 0, x + headW / 2, 0);
    mg.addColorStop(0, '#141517'); mg.addColorStop(0.3, '#5d626a'); mg.addColorStop(0.55, '#2b2d31'); mg.addColorStop(1, '#0f1012');
    ctx.fillStyle = mg; roundRect(x - headW / 2, headTop, headW, headH, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let k = 0; k < 4; k++) ctx.fillRect(x - headW / 2 + 5, headTop + 7 + k * 6 * S, headW - 10, 2);
    ctx.fillStyle = '#ff5a14'; ctx.fillRect(x - headW * 0.32, headTop + headH - 9 * S, headW * 0.64, 3);
    // cone e porca da pinça
    const ng = ctx.createLinearGradient(x - 12 * S, 0, x + 12 * S, 0);
    ng.addColorStop(0, '#3a3d42'); ng.addColorStop(0.45, '#c9ced4'); ng.addColorStop(1, '#2a2c30');
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.moveTo(x - 13 * S, headTop + headH); ctx.lineTo(x + 13 * S, headTop + headH); ctx.lineTo(x + 9 * S, headTop + headH + nutH); ctx.lineTo(x - 9 * S, headTop + headH + nutH); ctx.closePath(); ctx.fill();
    // fresa de topo: corpo com canais helicoidais em movimento
    const fy = headTop + headH + nutH;
    const cg = ctx.createLinearGradient(x - fw / 2, 0, x + fw / 2, 0);
    cg.addColorStop(0, '#4a4e54'); cg.addColorStop(0.4, '#e4e7eb'); cg.addColorStop(0.7, '#8b9097'); cg.addColorStop(1, '#2a2c30');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(x - fw / 2, fy); ctx.lineTo(x + fw / 2, fy); ctx.lineTo(x + fw / 2, tip - 2); ctx.lineTo(x + fw / 2 - 2, tip); ctx.lineTo(x - fw / 2 + 2, tip); ctx.lineTo(x - fw / 2, tip - 2); ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(x - fw / 2, fy + fl * 0.25, fw, fl * 0.75); ctx.clip();
    const spin = cutter.lift < 0.5 ? time * 26 : time * 4;
    const pitch = 9 * S;
    ctx.strokeStyle = 'rgba(20,22,26,.75)'; ctx.lineWidth = 2.2 * S;
    for (let k = -2; k < fl / pitch + 2; k++) {
      const yy = fy + k * pitch + ((spin * pitch) / (Math.PI * 2)) % pitch;
      ctx.beginPath(); ctx.moveTo(x - fw / 2, yy + pitch * 0.6); ctx.lineTo(x + fw / 2, yy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8;
    for (let k = -2; k < fl / pitch + 2; k++) {
      const yy = fy + k * pitch + ((spin * pitch) / (Math.PI * 2)) % pitch + 2.2 * S;
      ctx.beginPath(); ctx.moveTo(x - fw / 2, yy + pitch * 0.6); ctx.lineTo(x + fw / 2, yy); ctx.stroke();
    }
    ctx.restore();
    // brilho de corte quando trabalhando
    if (cutter.lift < 0.05) {
      const g = ctx.createRadialGradient(x + 2, tip, 0, x + 2, tip, 14);
      g.addColorStop(0, 'rgba(255,220,160,.55)'); g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 12, tip - 14, 28, 28);
    }
    ctx.restore();
  }

  function drawWheel() {
    const fa = railFade(tool.wx);
    if (fa <= 0) return;
    ctx.save();
    ctx.globalAlpha = fa;
    const wr = r * (mobile ? 0.95 : 1.05);
    const x = tool.wx;
    const work = cy - r - wr, park = railY + 26 + wr;
    const y = work - Math.max(0, work - park) * tool.wLift;
    // braço até o carro no trilho
    ctx.fillStyle = '#26282c';
    roundRect(x - 26, railY - 7, 52, 14, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    const top = Math.min(railY + 7, y);
    const ag = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
    ag.addColorStop(0, '#1c1d20'); ag.addColorStop(0.5, '#70757c'); ag.addColorStop(1, '#1c1d20');
    ctx.fillStyle = ag;
    ctx.fillRect(x - 5, top, 10, Math.max(0, y - top));
    // pedra abrasiva
    const g = ctx.createRadialGradient(x - wr * 0.3, y - wr * 0.3, wr * 0.1, x, y, wr);
    g.addColorStop(0, '#b9b4aa'); g.addColorStop(0.7, '#8a857c'); g.addColorStop(1, '#5c5852');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, wr, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, wr, 0, Math.PI * 2); ctx.clip();
    for (const [a, d, t] of grit) {
      const ang = a + wheelA, rr = wr * (0.25 + d * 0.72);
      ctx.fillStyle = t > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 1.6, 1.6);
    }
    // borrão de rotação
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(x, y, wr * (0.5 + k * 0.17), wheelA + k, wheelA + k + 1.2); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, wr, 0, Math.PI * 2); ctx.stroke();
    // flange e cubo
    ctx.fillStyle = '#3a3d42';
    ctx.beginPath(); ctx.arc(x, y, wr * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16171a';
    ctx.beginPath(); ctx.arc(x, y, wr * 0.09, 0, Math.PI * 2); ctx.fill();
    // proteção (capa) na metade de cima
    ctx.fillStyle = '#2a2c30';
    ctx.beginPath();
    ctx.arc(x, y, wr + 5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.arc(x, y, wr + 1, Math.PI * 2.05, Math.PI * 0.95, true);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff5a14';
    ctx.fillRect(x - wr * 0.5, y - wr - 6, wr, 2);
    ctx.restore();
  }

  function drawGun() {
    const fa = railFade(gun.x);
    if (fa <= 0) return;
    ctx.save();
    ctx.globalAlpha = fa;
    drawGunBody();
    ctx.restore();
  }

  function drawGunBody() {
    const x = gun.x;
    // carro no trilho
    ctx.fillStyle = '#26282c';
    roundRect(x - 22, railY - 7, 44, 14, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.fillStyle = emit > 0.5 && Math.sin(time * 12) > 0 ? '#ff5a14' : '#5a2a14';
    ctx.beginPath();
    ctx.arc(x + 14, railY, 2, 0, Math.PI * 2);
    ctx.fill();

    // haste (encolhe quando a tocha recua)
    const L = Math.max(0, bodyTop - railY - 14) * tool.gLift;
    ctx.save();
    ctx.translate(0, -L);
    const rg = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    rg.addColorStop(0, '#1c1d20');
    rg.addColorStop(0.5, '#70757c');
    rg.addColorStop(1, '#1c1d20');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 3, railY + 7 + L, 6, Math.max(0, bodyTop - railY - 7 - L));

    // corpo
    const bg = ctx.createLinearGradient(x - bodyW / 2, 0, x + bodyW / 2, 0);
    bg.addColorStop(0, '#141517');
    bg.addColorStop(0.3, '#5d626a');
    bg.addColorStop(0.55, '#2b2d31');
    bg.addColorStop(1, '#0f1012');
    ctx.fillStyle = bg;
    roundRect(x - bodyW / 2, bodyTop, bodyW, bodyH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 3; k++) ctx.fillRect(x - bodyW / 2 + 6, bodyTop + 12 + k * 7, bodyW - 12, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `500 ${mobile ? 8 : 9}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('TFM', x, bodyTop + bodyH - 20);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff5a14';
    ctx.fillRect(x - bodyW * 0.32, bodyTop + bodyH - 9, bodyW * 0.64, 4);

    drawNozzle(x, PROCESSES[proc].torch);

    if (emit > 0.02 && PROCESSES[proc].torch !== 'pta') {
      ctx.globalCompositeOperation = 'lighter';
      const s = 56 * (0.85 + Math.random() * 0.2);
      ctx.globalAlpha = emit;
      ctx.drawImage(glow, x - s / 2, tipY - s / 2 + 4, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function metal(x0, x1, dark = '#17181b', light = '#8b9097') {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, dark);
    g.addColorStop(0.45, light);
    g.addColorStop(1, dark);
    return g;
  }

  function drawNozzle(x, type) {
    const top = bodyTop + bodyH;
    const L = tipY - top;
    if (type === 'pta') {
      // tocha de PTA: corpo refrigerado, alimentação de pó e bocal cerâmico junto à peça
      const end = tipFor('pta');
      ctx.fillStyle = metal(x - 7, x + 7);
      ctx.fillRect(x - 6, top, 12, Math.max(0, end - top - 12));
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x - 6, top + 6 + k * 6, 12, 1.5);
      ctx.fillStyle = metal(x - 10, x + 10, '#6b3a1c', '#e8a06a');
      ctx.beginPath();
      ctx.moveTo(x - 9, end - 12);
      ctx.lineTo(x + 9, end - 12);
      ctx.lineTo(x + 5, end);
      ctx.lineTo(x - 5, end);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c9c4bb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - bodyW / 2 - 4, bodyTop + 20);
      ctx.quadraticCurveTo(x - 20, end - 30, x - 7, end - 10);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2f6fd6';
      ctx.beginPath();
      // mangueira de água: sai do corpo e sobe junto da haste até o carro no trilho
      ctx.moveTo(x + bodyW / 2 - 2, bodyTop + 14);
      ctx.bezierCurveTo(x + bodyW / 2 + 12, bodyTop + 6, x + 10, bodyTop - 14, x + 6, bodyTop - 26);
      ctx.lineTo(x + 6, railY + 9);
      ctx.stroke();
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(x + bodyW / 2 - 5, bodyTop + 10, 6, 8);
    } else if (type === 'hvof') {
      // cano longo de combustão com anéis de refrigeração
      ctx.fillStyle = metal(x - 7, x + 7);
      ctx.fillRect(x - 6, top, 12, L * 0.35);
      ctx.beginPath();
      ctx.moveTo(x - 6, top + L * 0.35);
      ctx.lineTo(x + 6, top + L * 0.35);
      ctx.lineTo(x + 3.5, tipY);
      ctx.lineTo(x - 3.5, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (let k = 0; k < 3; k++) ctx.fillRect(x - 6, top + 3 + k * 4, 12, 1.5);
      ctx.fillStyle = '#ff5a14';
      ctx.fillRect(x - 6, top + L * 0.35 - 2, 12, 2);
    } else if (type === 'plasma') {
      // mangueiras de água, anodo de cobre e injetor de pó
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2f6fd6';
      ctx.beginPath();
      ctx.moveTo(x - bodyW / 2, bodyTop + 14);
      ctx.quadraticCurveTo(x - bodyW / 2 - 18, bodyTop - 10, x - bodyW / 2 - 6, bodyTop - 30);
      ctx.stroke();
      ctx.strokeStyle = '#c8402a';
      ctx.beginPath();
      ctx.moveTo(x + bodyW / 2, bodyTop + 14);
      ctx.quadraticCurveTo(x + bodyW / 2 + 18, bodyTop - 10, x + bodyW / 2 + 6, bodyTop - 30);
      ctx.stroke();
      ctx.fillStyle = metal(x - 9, x + 9, '#5a3018', '#e0915a');
      ctx.beginPath();
      ctx.moveTo(x - 9, top);
      ctx.lineTo(x + 9, top);
      ctx.lineTo(x + 6, tipY);
      ctx.lineTo(x - 6, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = metal(x + 8, x + 14);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 16, top + 2);
      ctx.lineTo(x + 6, tipY + 2);
      ctx.stroke();
    } else {
      // dois arames de cobre convergindo no bico de ar
      ctx.fillStyle = metal(x - 10, x + 10);
      ctx.fillRect(x - 10, top, 20, L * 0.4);
      ctx.lineWidth = 2;
      [-1, 1].forEach((d) => {
        const wx = x + d * (bodyW / 2 + 7);
        // alimentador lateral
        ctx.fillStyle = metal(wx - 5, wx + 5);
        roundRect(wx - 5, bodyTop + 10, 10, 18, 3);
        ctx.fill();
        ctx.strokeStyle = '#d98a45';
        ctx.beginPath();
        ctx.moveTo(wx, bodyTop + 28);
        ctx.quadraticCurveTo(wx, top + L * 0.3, x + d * 4, tipY + 1);
        ctx.stroke();
      });
      ctx.fillStyle = metal(x - 6, x + 6);
      ctx.fillRect(x - 5, top + L * 0.4, 10, 3);
    }
  }

  function drawHud() {
    const label = phase === 'spray' && PROCESSES[proc].torch === 'pta' ? 'DEPOSIÇÃO PTA'
      : phase === 'grind' && phaseT < G_IN ? 'TROCA DE FERRAMENTA'
      : phase === 'wear' ? (phaseT < 2.0 ? 'TRINCA DETECTADA' : phaseT < C_IN + C_DUR + 0.4 ? 'USINAGEM · REBAIXO' : 'TROCA DE FERRAMENTA') : LABELS[phase];
    const pct = Math.round((phase === 'wear' ? 0 : progress) * 100);
    ctx.save();
    if (mobile) {
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = phase === 'done' ? '#7ddc9a' : '#ff8a1f';
      ctx.fillText(`${label} · ${pct}%`, railB, railY + 22);
      ctx.restore();
      return;
    }
    const pw = 214, ph = 122;
    let px = gun.x + bodyW / 2 + 18;
    if (px + pw > W - 12) px = gun.x - bodyW / 2 - 18 - pw;
    const py = bodyTop - 10;
    ctx.fillStyle = 'rgba(11,11,12,0.72)';
    roundRect(px, py, pw, ph, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
    const dim = 'rgba(255,255,255,0.45)';
    const bright = 'rgba(255,255,255,0.92)';
    const row = (y, a, b, colA, colB) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = colA;
      ctx.fillText(a, px + 14, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = colB;
      ctx.fillText(b, px + pw - 14, y);
    };
    ctx.fillStyle = phase === 'done' ? '#7ddc9a' : '#ff8a1f';
    ctx.beginPath();
    ctx.arc(px + 17, py + 18.5, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillText(label, px + 26, py + 22);
    const [pName, pMat] = PROCESSES[proc].name.split(' · ');
    row(py + 42, 'PROCESSO', pName, dim, bright);
    row(py + 60, 'MATERIAL', pMat, dim, bright);
    row(py + 78, 'RECUPERAÇÃO', `${pct}%`, dim, bright);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    const gi = clamp(Math.floor(gun.x / COL), 0, cols - 1);
    row(py + 96, 'SUBSTRATO', `${Math.round(25 + heat[gi] * (TORCHES[PROCESSES[proc].torch].hot ? 420 : 125))} °C`, dim, heat[gi] > 0.6 ? '#ffb070' : bright);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(px + 14, py + 106, pw - 28, 2);
    const bar = ctx.createLinearGradient(px + 14, 0, px + pw - 14, 0);
    bar.addColorStop(0, '#ffc46b');
    bar.addColorStop(1, '#ff5a14');
    ctx.fillStyle = bar;
    ctx.fillRect(px + 14, py + 106, (pw - 28) * (pct / 100), 2);

    if (!pointerUsed) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText('↔ mova o cursor para guiar', px + pw, py + ph + 18);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, rr) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, rr);
    else ctx.rect(x, y, w, h);
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawRail();
    drawShaft();
    drawHeat();
    drawSmoke();
    drawSprayFx();
    drawCracks();
    drawGun();
    drawCutter();
    drawChips();
    drawWheel();
    drawHud();
  }

  // ---------- loop ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (!ready) return;
    const t0 = performance.now();
    update(dt);
    draw();
    frameCost = frameCost * 0.95 + (performance.now() - t0) * 0.05;
    if (frameCost > 12 && quality > 0.4 && now > degradeAt) degrade(now);
  }

  function degrade(now) {
    degradeAt = now + 3000;
    quality = quality === 1 ? 0.6 : 0.35;
    dprCap = quality === 0.6 ? 1.25 : 1;
    DPR = Math.min(window.devicePixelRatio || 1, dprCap);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    frameCost = 8;
  }

  function start() {
    if (running || reduced || !inView || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function staticFrame() {
    if (!ready) return;
    phase = 'spray';
    phaseT = 0;
    for (let i = zoneI0; i <= zoneI1; i++) wear[i] = target[i];
    for (let s = 0; s < 150; s++) update(1 / 60);
    draw();
  }

  // ---------- eventos ----------
  const hero = canvas.parentElement;
  // mouse guia a pistola; no toque, arrastar na horizontal também guia (a rolagem vertical continua livre)
  const steer = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.pointerType !== 'mouse' && (e.clientY - rect.top > cy + r + 40)) return;
    pointerX = e.clientX - rect.left;
    pointerT = time;
  };
  hero.addEventListener('pointermove', steer);
  hero.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && steer(e));
  hero.addEventListener('pointerleave', () => { pointerT = -99; });

  let resizeTimer;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layout();
      if (reduced) staticFrame();
    }, 120);
  });

  const io = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) start(); else stop();
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  buildTextures();
  layout();
  ro.observe(canvas);
  io.observe(canvas);
  if (reduced) staticFrame();
  else start();

  // escolha manual do processo (botões no hero)
  function setProcess(torch) {
    const idx = PROCESSES.findIndex((p) => p.torch === torch);
    if (idx < 0) return;
    locked = true;
    proc = idx;
    newZone();
    if (reduced) staticFrame();
  }
  return { relayout: layout, stop, setProcess };
}
