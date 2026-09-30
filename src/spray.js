// Simulação de aspersão térmica no hero.
// Um eixo gira, surge uma zona desgastada e a pistola (guiada pelo cursor ou
// em piloto automático) deposita o revestimento até recuperar o diâmetro.
// Depois vem a retífica e o ciclo recomeça em outro ponto do eixo.

const COL = 3; // largura de cada coluna do eixo (px)
const KERNEL = [0.15, 0.45, 0.8, 1, 0.8, 0.45, 0.15];
const PROCESSES = ['HVOF · WC-Co', 'PLASMA · Cr₂O₃', 'ARC SPRAY · INOX 420', 'HVOF · WC-CrC-Ni'];
const LABELS = { wear: 'DIAGNÓSTICO', spray: 'ASPERSÃO', grind: 'RETÍFICA', done: 'RECUPERADO ✓' };
const PART_COLORS = ['rgba(255,246,220,0.95)', 'rgba(255,196,100,0.85)', 'rgba(255,118,36,0.8)'];

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
  let cols = 0, wear, target, coat, heat, polish;
  let zoneA = 0, zoneB = 0, zoneI0 = 0, zoneI1 = 0, zoneMM = 0.8, proc = 0;
  let phase = 'wear', phaseT = 0, sweepX = 0, progress = 0, layerMM = 0;
  let time = 0, emit = 0, emitAcc = 0;
  let pointerX = null, pointerT = -99, pointerUsed = reduced;
  const gun = { x: 0, vx: 0, dir: 1 };
  const parts = [];
  const sparks = [];
  let chrome, worn, coating, glow;
  let running = false, raf = 0, last = 0, inView = true, ready = false;

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
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
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
      railY = b.header + 22;
      railA = gutter; railB = W - gutter;
      shaftA = -40; journal = 0;
    } else {
      r = clamp(H * 0.075, 46, 80);
      bodyW = 58; bodyH = 84; nozzleLen = 36;
      railY = b.header + 58;
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
    for (let i = 0; i < cols; i++) { wear[i] = 0; target[i] = 0; coat[i] = 0; polish[i] = 0; }
    for (let i = zoneI0; i <= zoneI1; i++) {
      const u = (i - zoneI0) / Math.max(1, zoneI1 - zoneI0);
      const edge = Math.min(1, Math.sin(Math.PI * u) * 1.6);
      target[i] = Math.pow(Math.max(0, edge), 0.7) * rand(0.9, 1);
    }
    zoneMM = Math.round(rand(0.5, 1.2) * 100) / 100;
    proc = (proc + 1) % PROCESSES.length;
    phase = 'wear';
    phaseT = 0;
    progress = 0;
  }

  const radiusAt = (i) => (i >= 0 && i < cols ? r - (wear[i] - coat[i]) * depth : r);
  const onShaft = (x) => x >= (mobile ? -40 : shaftA) && x <= W + 40;

  // ---------- simulação ----------
  function update(dt) {
    time += dt;
    phaseT += dt;
    const steering = time - pointerT < 2.5 && pointerX !== null;

    // máquina de estados
    if (phase === 'wear') {
      const k = easeInOut(clamp(phaseT / 1.2, 0, 1));
      for (let i = zoneI0; i <= zoneI1; i++) wear[i] = target[i] * k;
      if (phaseT > 1.5) { phase = 'spray'; phaseT = 0; }
    } else if (phase === 'spray') {
      let sw = 0, sc = 0;
      for (let i = zoneI0; i <= zoneI1; i++) { sw += wear[i]; sc += coat[i]; }
      progress = sw ? sc / sw : 1;
      if (progress > 0.985) {
        for (let i = zoneI0; i <= zoneI1; i++) coat[i] = wear[i];
        progress = 1; phase = 'grind'; phaseT = 0; sweepX = zoneA - 10;
      }
    } else if (phase === 'grind') {
      const k = easeInOut(clamp(phaseT / 1.6, 0, 1));
      sweepX = zoneA - 10 + (zoneB - zoneA + 20) * k;
      for (let i = zoneI0; i <= zoneI1; i++) {
        if (i * COL < sweepX) polish[i] = Math.min(1, polish[i] + dt * 5);
      }
      if (Math.random() < 0.9) spawnSpark(sweepX, cy - r + rand(0, 6), true);
      if (phaseT > 1.7) { phase = 'done'; phaseT = 0; }
    } else if (phase === 'done' && phaseT > 1.8) {
      newZone();
    }

    // pistola
    const minG = railA + bodyW * 0.7, maxG = railB - bodyW * 0.7;
    let tx;
    if (steering) {
      pointerUsed = true;
      tx = clamp(pointerX, minG, maxG);
    } else if (phase === 'spray') {
      const speed = mobile ? 120 : 170;
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

    // emissão
    const wantEmit = phase === 'spray' ? 1 : 0;
    emit += (wantEmit - emit) * (1 - Math.exp(-10 * dt));
    const rate = (mobile ? 380 : 720) * emit;
    emitAcc += rate * dt;
    const spread = 0.15;
    while (emitAcc >= 1) {
      emitAcc -= 1;
      const a = rand(-spread, spread) * (Math.random() < 0.8 ? 0.6 : 1);
      const sp = rand(900, 1400) * (sprayLen / 200 + 0.4);
      parts.push({ x: gun.x + rand(-1.5, 1.5), y: tipY + 2, vx: Math.sin(a) * sp + gun.vx * 0.25, vy: Math.cos(a) * sp, y0: tipY });
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
    const decay = Math.exp(-1.1 * dt);
    let prev = heat[0];
    for (let i = 1; i < cols - 1; i++) {
      const cur = heat[i];
      heat[i] = (cur * 0.8 + (prev + heat[i + 1]) * 0.1) * decay;
      prev = cur;
    }

    // leituras
    let sc = 0, n = 0;
    for (let i = zoneI0; i <= zoneI1; i++) { sc += coat[i]; n++; }
    layerMM = n ? (sc / n) * zoneMM * 1.35 : 0;
  }

  function impact(i, p) {
    for (let d = -3; d <= 3; d++) {
      const j = i + d;
      if (j < 0 || j >= cols) continue;
      const w = KERNEL[d + 3];
      if (phase === 'spray') {
        const room = wear[j] - coat[j];
        if (room > 0) coat[j] += Math.min(room, 0.0105 * w);
      }
      heat[j] = Math.min(1, heat[j] + 0.03 * w);
    }
    if (Math.random() < 0.1) spawnSpark(p.x, p.y, false);
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

    // ponta (colo) à esquerda no desktop
    if (!mobile) {
      const jr = r * 0.62;
      ctx.drawImage(chrome, 0, 0, 1, 256, x0 - journal, cy - jr, journal + 2, jr * 2);
      endCap(x0 - journal, jr);
      endCap(x0, r, true);
    }

    // trechos íntegros
    ctx.drawImage(chrome, 0, 0, 1, 256, x0, cy - r, Math.max(0, zA - x0), r * 2);
    ctx.drawImage(chrome, 0, 0, 1, 256, zB, cy - r, W - zB + 40, r * 2);

    // zona de trabalho, coluna a coluna
    for (let i = zoneI0; i <= zoneI1; i++) {
      const x = i * COL;
      const rc = radiusAt(i);
      const sx = i % 128;
      const w = wear[i];
      if (w < 0.01 && polish[i] < 0.01) {
        ctx.drawImage(chrome, 0, 0, 1, 256, x, cy - rc, COL + 0.6, rc * 2);
        continue;
      }
      ctx.drawImage(worn, sx, 0, 1, 256, x, cy - rc, COL + 0.6, rc * 2);
      const c = w > 0 ? clamp(coat[i] / w, 0, 1) : 0;
      if (c > 0.01) {
        ctx.globalAlpha = c;
        ctx.drawImage(coating, sx, 0, 1, 256, x, cy - rc, COL + 0.6, rc * 2);
      }
      if (polish[i] > 0.01) {
        ctx.globalAlpha = polish[i];
        ctx.drawImage(chrome, 0, 0, 1, 256, x, cy - rc, COL + 0.6, rc * 2);
      }
      ctx.globalAlpha = 1;
    }

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
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x0, cy - r, Math.max(0, zA - x0), 1);
    ctx.fillRect(zB, cy - r, W - zB + 40, 1);
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
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < cols; i++) {
      const h = heat[i];
      if (h < 0.02) continue;
      const x = i * COL;
      if (!onShaft(x)) continue;
      const rc = radiusAt(i);
      ctx.fillStyle = `rgba(255,${(70 + h * 130) | 0},${(10 + h * 50) | 0},${h * 0.75})`;
      ctx.fillRect(x, cy - rc, COL + 0.6, rc * 0.9);
      ctx.fillStyle = `rgba(255,80,20,${h * 0.28})`;
      ctx.fillRect(x, cy - rc * 0.1, COL + 0.6, rc * 1.1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSprayFx() {
    ctx.globalCompositeOperation = 'lighter';
    const surf = cy - r;

    if (emit > 0.02) {
      // jato
      const half = Math.tan(0.15) * sprayLen * 0.7;
      const g = ctx.createLinearGradient(0, tipY, 0, surf);
      g.addColorStop(0, `rgba(255,236,190,${0.5 * emit})`);
      g.addColorStop(0.35, `rgba(255,150,60,${0.2 * emit})`);
      g.addColorStop(1, `rgba(255,90,20,${0.05 * emit})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(gun.x - 3, tipY);
      ctx.lineTo(gun.x + 3, tipY);
      ctx.lineTo(gun.x + half, surf);
      ctx.lineTo(gun.x - half, surf);
      ctx.closePath();
      ctx.fill();
      // diamantes de choque (HVOF)
      for (let k = 0; k < 4; k++) {
        const y = tipY + 9 + k * 11;
        if (y > surf) break;
        ctx.fillStyle = `rgba(255,240,210,${(0.55 - k * 0.12) * emit})`;
        ctx.beginPath();
        ctx.ellipse(gun.x, y, 2.4, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // brilho no impacto
      const s = (mobile ? 110 : 170) * (0.9 + Math.sin(time * 40) * 0.05);
      ctx.globalAlpha = 0.85 * emit;
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
      ctx.strokeStyle = PART_COLORS[b];
      ctx.lineWidth = b === 0 ? 1.1 : 1.5;
      ctx.stroke();
    }

    // faíscas
    ctx.beginPath();
    for (let n = 0; n < sparks.length; n++) {
      const s = sparks[n];
      ctx.moveTo(s.x - s.vx * 0.018, s.y - s.vy * 0.018);
      ctx.lineTo(s.x, s.y);
    }
    ctx.strokeStyle = 'rgba(255,200,120,0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // retífica
    if (phase === 'grind') {
      const g = ctx.createLinearGradient(sweepX - 30, 0, sweepX + 6, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(sweepX - 30, cy - r, 36, r * 2);
      const s = 90;
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glow, sweepX - s / 2, cy - r - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawGun() {
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

    // haste
    const rg = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
    rg.addColorStop(0, '#1c1d20');
    rg.addColorStop(0.5, '#70757c');
    rg.addColorStop(1, '#1c1d20');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 3, railY + 7, 6, Math.max(0, bodyTop - railY - 7));

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

    // bico
    const ng = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    ng.addColorStop(0, '#1a1b1e');
    ng.addColorStop(0.45, '#8b9097');
    ng.addColorStop(1, '#1a1b1e');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.moveTo(x - 9, bodyTop + bodyH);
    ctx.lineTo(x + 9, bodyTop + bodyH);
    ctx.lineTo(x + 4.5, tipY);
    ctx.lineTo(x - 4.5, tipY);
    ctx.closePath();
    ctx.fill();

    if (emit > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const s = 56 * (0.85 + Math.random() * 0.2);
      ctx.globalAlpha = emit;
      ctx.drawImage(glow, x - s / 2, tipY - s / 2 + 4, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawHud() {
    const label = LABELS[phase];
    const pct = Math.round((phase === 'wear' ? 0 : progress) * 100);
    const mm = layerMM.toFixed(2).replace('.', ',');
    ctx.save();
    if (mobile) {
      ctx.font = '500 10px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = phase === 'done' ? '#7ddc9a' : '#ff8a1f';
      ctx.fillText(`${label} · ${pct}%`, railB, railY + 22);
      ctx.restore();
      return;
    }
    const pw = 214, ph = 104;
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
    row(py + 42, 'PROCESSO', PROCESSES[proc], dim, bright);
    row(py + 60, 'CAMADA', `${mm} mm`, dim, bright);
    row(py + 78, 'RECUPERAÇÃO', `${pct}%`, dim, bright);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(px + 14, py + 88, pw - 28, 2);
    const bar = ctx.createLinearGradient(px + 14, 0, px + pw - 14, 0);
    bar.addColorStop(0, '#ffc46b');
    bar.addColorStop(1, '#ff5a14');
    ctx.fillStyle = bar;
    ctx.fillRect(px + 14, py + 88, (pw - 28) * (pct / 100), 2);

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
    drawSprayFx();
    drawGun();
    drawHud();
  }

  // ---------- loop ----------
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (!ready) return;
    update(dt);
    draw();
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
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    pointerT = time;
  });
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

  return { relayout: layout, stop };
}
