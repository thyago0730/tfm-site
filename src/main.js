import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initSpray } from './spray.js';
import { initJourney, initBeforeAfter } from './journey.js';
import { initMatrix } from './matrix.js';
import { initSimulator } from './simulator.js';
import { initWizard } from './wizard.js';
import { initConsent, logAnalytics } from './analytics.js';
import { initWhatsApp, injectContextual, waUrl, WHATSAPP } from './whatsapp.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const EMAIL = 'contato@tfmrevestimentos.com.br';

root.classList.add('is-ready');
root.classList.remove('no-anim');

/* ---------------- scroll suave ---------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(target) {
  const header = parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76;
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  const offset = el.id === 'topo' ? 0 : -header + 1;
  // posição calculada a partir do scroll real (evita divergência com o estado interno do Lenis)
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY + offset);
  if (lenis) lenis.scrollTo(top, { duration: 1.4 });
  else window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2 || !$(id)) return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(id);
  history.replaceState(null, '', id === '#topo' ? location.pathname : id);
});

/* ---------------- header ---------------- */
const header = $('[data-header]');
let lastY = 0;
function onScroll(y) {
  header.classList.toggle('is-scrolled', y > 40);
  const down = y > lastY;
  header.classList.toggle('is-hidden', down && y > 500 && !root.classList.contains('menu-open'));
  lastY = y;
}
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

// link ativo no menu
function initNav() {
  $$('.nav a').forEach((link) => {
    const section = $(link.getAttribute('href'));
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    });
  });
}

/* ---------------- menu móvel ---------------- */
const burger = $('[data-burger]');
const menu = $('[data-menu]');
function closeMenu() {
  if (!root.classList.contains('menu-open')) return;
  root.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Abrir menu');
  menu.setAttribute('aria-hidden', 'true');
  lenis?.start();
}
burger.addEventListener('click', () => {
  const open = !root.classList.contains('menu-open');
  if (!open) return closeMenu();
  root.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Fechar menu');
  menu.setAttribute('aria-hidden', 'false');
  header.classList.remove('is-hidden');
  lenis?.stop();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

/* ---------------- hero ---------------- */
const hero = $('[data-hero]');

function offsetWithin(el, ancestor) {
  let x = 0, y = 0, node = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function heroBounds() {
  const specs = offsetWithin($('.hero__specs', hero), hero);
  const items = [...$$('.line__in', hero), $('.hero__lead', hero), ...$$('.hero__ctas .btn', hero)].map((el) => offsetWithin(el, hero));
  return {
    floor: specs.y,
    contentRight: Math.max(...items.map((b) => b.x + b.w)),
    contentTop: offsetWithin($('.hero .eyebrow', hero), hero).y,
    header: parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 76,
  };
}

function heroIntro() {
  const lines = $$('.hero__title .line__in');
  const fades = $$('.hero [data-fade]');
  if (reduced) {
    gsap.set(fades, { opacity: 1 });
    root.classList.add('is-loaded');
    return;
  }
  gsap.set(lines, { yPercent: 110 });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' })
    .add(() => root.classList.add('is-loaded'))
    .to(lines, { yPercent: 0, duration: 1.4, stagger: 0.1 }, '-=0.45')
    .fromTo('.hero .eyebrow', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1 }, '<')
    .fromTo(fades, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1 }, '-=1.05')
    .fromTo('.hero__canvas', { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' }, '-=1.3');

  // saída do hero no scroll
  gsap.to('[data-hero-inner]', {
    yPercent: -18,
    opacity: 0.15,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------------- textos ---------------- */
function initSplits() {
  if (reduced) return;
  // cada título só é dividido em linhas quando se aproxima da tela (menos trabalho na carga)
  $$('[data-split]:not([data-split="hero"])').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom+=400',
      once: true,
      onEnter: () => {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, {
              yPercent: 115,
              duration: 1.2,
              ease: 'expo.out',
              stagger: 0.08,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            }),
        });
      },
    });
  });

  // manifesto: palavras passam do cinza para a cor final com o scroll
  const manifesto = $('[data-words]');
  if (manifesto) {
    const split = SplitText.create(manifesto, { type: 'words', wordsClass: 'w' });
    gsap.to(split.words, {
      color: (i, el) => (el.closest('em') ? '#b03603' : '#0e0e10'),
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
  }
}

function initReveals() {
  const reveal = $$('[data-reveal]');
  const fades = $$('[data-fade]').filter((el) => !el.closest('.hero'));
  if (reduced) {
    gsap.set([...reveal, ...fades], { opacity: 1 });
    return;
  }
  gsap.set(reveal, { y: 48 });
  gsap.set(fades, { y: 24 });
  ScrollTrigger.batch(reveal, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09 }),
  });
  ScrollTrigger.batch(fades, {
    start: 'top 92%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }),
  });

  // imagens dos cases
  ScrollTrigger.batch('.case__img', {
    start: 'top 90%',
    once: true,
    onEnter: (els) =>
      gsap.fromTo(els, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1.3, ease: 'expo.out', stagger: 0.08 }),
  });
}

/* ---------------- contadores ---------------- */
function initCounters() {
  const year = new Date().getFullYear();
  $$('[data-count]').forEach((el) => {
    const since = +el.dataset.since;
    const end = since ? year - since : +el.dataset.count;
    el.textContent = end;
    if (reduced) return;
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: end,
          duration: 2,
          ease: 'power3.out',
          onUpdate: () => (el.textContent = Math.round(obj.v)),
        }),
    });
  });
  $$('[data-year]').forEach((el) => (el.textContent = year));
}

/* ---------------- marquees ---------------- */
function initMarquees() {
  $$('[data-marquee]').forEach((wrap) => {
    const track = $('.marquee__track', wrap);
    const items = [...track.children];
    // duplica até cobrir 2x a largura da tela
    while (track.scrollWidth < window.innerWidth * 2.2) items.forEach((n) => track.appendChild(n.cloneNode(true)));
    [...track.children].forEach((n) => track.appendChild(n.cloneNode(true)));
    [...track.children].slice(track.children.length / 2).forEach((n) => n.setAttribute('aria-hidden', 'true'));
    if (reduced) return;
    const speed = wrap.dataset.marquee === 'slow' || wrap.dataset.marquee === 'reverse' ? 60 : 40;
    const tween = wrap.dataset.marquee === 'reverse'
      ? gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: speed, ease: 'none', repeat: -1 })
      : gsap.to(track, { xPercent: -50, duration: speed, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
      trigger: wrap,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const v = Math.min(Math.abs(self.getVelocity()) / 400, 5);
        gsap.to(tween, { timeScale: (1 + v) * (self.direction === 1 ? 1 : -1), duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: self.direction === 1 ? 1 : -1, duration: 1.2, delay: 0.2 });
      },
    });
  });
}

/* ---------------- posição do ponteiro ---------------- */
const pointer = { x: -1, y: -1 };
const pointerSubs = new Set();
let pointerQueued = false;
const flushPointer = () => {
  pointerQueued = false;
  pointerSubs.forEach((fn) => fn());
};
const queuePointer = () => {
  if (pointerQueued) return;
  pointerQueued = true;
  requestAnimationFrame(flushPointer);
};
function onPointerFrame(fn) {
  pointerSubs.add(fn);
}
if (finePointer) {
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; queuePointer(); }, { passive: true });
  window.addEventListener('scroll', queuePointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1; queuePointer(); });
  window.addEventListener('blur', () => { pointer.x = pointer.y = -1; queuePointer(); });
}

/* ---------------- serviços ---------------- */
function initServices() {
  const list = $('[data-services]');
  if (!list) return;
  const items = $$('.svc__item', list);
  items.forEach((item) => {
    const btn = $('.svc__head', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach((i) => {
        i.classList.remove('is-open');
        $('.svc__head', i).setAttribute('aria-expanded', 'false');
      });
      if (open) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
      setTimeout(() => ScrollTrigger.refresh(), 520);
    });
  });

  // imagem que segue o cursor
  const preview = $('[data-svc-preview]');
  if (!finePointer || !preview || reduced) return;
  const img = $('img', preview);
  const xTo = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
  const yTo = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
  items.forEach((item) => { new Image().src = item.dataset.img; });

  let visible = false;
  let current = null;
  const show = (item) => {
    if (item !== current) {
      current = item;
      img.src = item.dataset.img;
    }
    if (!visible) {
      visible = true;
      gsap.set(preview, { x: pointer.x + 170, y: pointer.y });
      xTo(pointer.x + 170);
      yTo(pointer.y);
    }
    gsap.to(preview, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  };
  const hide = () => {
    current = null;
    if (!visible) return;
    visible = false;
    gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.35, ease: 'power3.in', overwrite: 'auto' });
  };

  // decide pela posição real do ponteiro: funciona também quando a página rola sem o mouse se mexer
  const check = () => {
    if (pointer.x < 0 || document.hidden) return hide();
    const r = list.getBoundingClientRect();
    const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
    const item = inside ? document.elementFromPoint(pointer.x, pointer.y)?.closest('.svc__item') : null;
    if (item && list.contains(item)) show(item);
    else hide();
  };
  onPointerFrame(check);
  list.addEventListener('mousemove', (e) => {
    xTo(e.clientX + 170);
    yTo(e.clientY);
    gsap.to(preview, { rotate: gsap.utils.clamp(-8, 8, e.movementX * 0.6), duration: 0.5 });
  });
}

/* ---------------- processo horizontal ---------------- */
function initProcess() {
  const section = $('[data-process]');
  const track = $('[data-process-track]');
  const bar = $('[data-process-bar]');
  if (!section || reduced) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px)', () => {
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + dist(),
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
      },
    });
    $$('.step', track).forEach((step) => {
      const art = $('.step__art', step);
      if (!art) return;
      gsap.from(art, {
        scale: 0.5,
        opacity: 0,
        rotate: -20,
        duration: 1,
        ease: 'back.out(1.6)',
        scrollTrigger: { trigger: step, containerAnimation: tween, start: 'left 80%', toggleActions: 'play none none reverse' },
      });
    });
  });
}

/* ---------------- seletor de soluções ---------------- */
function initSelector() {
  const wrap = $('[data-selector]');
  if (!wrap) return;
  const tabs = $$('[role="tab"]', wrap);
  const select = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      const panel = $('#' + t.getAttribute('aria-controls'));
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
      if (on && !reduced) {
        gsap.fromTo(panel.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' });
      }
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      select(next, true);
    });
  });
}

/* ---------------- setores ---------------- */
function initPanels() {
  const wrap = $('[data-panels]');
  if (!wrap) return;
  const panels = $$('.panel', wrap);
  const desktop = matchMedia('(min-width: 901px)');
  panels.forEach((p) => {
    $('.panel__body', p).dataset.title = $('.panel__title', p).textContent;
    p.setAttribute('aria-expanded', p.classList.contains('is-open'));
  });
  const open = (panel, toggle) => {
    const willOpen = toggle ? !panel.classList.contains('is-open') : true;
    panels.forEach((p) => {
      p.classList.toggle('is-open', p === panel && willOpen);
      p.setAttribute('aria-expanded', p === panel && willOpen);
    });
    if (!desktop.matches) setTimeout(() => ScrollTrigger.refresh(), 520);
  };
  panels.forEach((p) => {
    p.addEventListener('mouseenter', () => desktop.matches && open(p));
    p.addEventListener('focus', () => desktop.matches && open(p));
    p.addEventListener('click', () => open(p, !desktop.matches));
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(p, !desktop.matches);
      }
    });
  });
}

/* ---------------- cases (arrastar) ---------------- */
function initCases() {
  const rail = $('[data-cases]');
  if (!rail) return;
  const step = () => ($('.case', rail)?.offsetWidth || 400) + 24;
  $('[data-cases-prev]')?.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
  $('[data-cases-next]')?.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));

  let down = false, startX = 0, startLeft = 0, moved = false;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.target.closest('a, button')) return;
    down = true;
    moved = false;
    startX = e.clientX;
    startLeft = rail.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4 && !moved) {
      moved = true;
      rail.classList.add('is-dragging');
    }
    if (moved) rail.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    if (moved) {
      // solta e deixa o snap assentar o card mais próximo
      const left = rail.scrollLeft;
      rail.classList.remove('is-dragging');
      rail.scrollLeft = left;
    }
  });
}

/* ---------------- linha do tempo ---------------- */
function initTimeline() {
  const tl = $('[data-timeline]');
  if (!tl || reduced) {
    if (tl) gsap.set('[data-timeline-fill]', { scaleY: 1 });
    return;
  }
  gsap.to('[data-timeline-fill]', {
    scaleY: 1,
    ease: 'none',
    scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: true },
  });
  $$('.tl', tl).forEach((item) => {
    gsap.from(item, {
      opacity: 0,
      y: 24,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: item, start: 'top 85%', once: true },
    });
  });
}

/* ---------------- cursor, magnético, spotlight ---------------- */
function initPointerFx() {
  if (!finePointer || reduced) return;
  root.classList.add('has-cursor');
  const cursor = $('.cursor');
  const dot = $('.cursor__dot', cursor);
  const ring = $('.cursor__ring', cursor);
  const label = $('.cursor__label', cursor);
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
  gsap.set(cursor, { opacity: 0 });
  let seen = false;
  window.addEventListener('pointermove', (e) => {
    if (!seen) {
      seen = true;
      gsap.set([dot, ring], { x: e.clientX, y: e.clientY });
      gsap.to(cursor, { opacity: 1, duration: 0.3 });
    }
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  });
  // estado do cursor recalculado pelo elemento sob o ponteiro (também após rolar sem mexer o mouse)
  let outside = false;
  onPointerFrame(() => {
    if (!seen) return;
    if (pointer.x < 0) {
      if (!outside) gsap.to(cursor, { opacity: 0, duration: 0.2 });
      outside = true;
      return;
    }
    if (outside) gsap.to(cursor, { opacity: 1, duration: 0.2 });
    outside = false;
    const el = document.elementFromPoint(pointer.x, pointer.y);
    const labeled = el?.closest('[data-cursor]');
    const hover = el?.closest('a, button, [data-magnetic], .panel, label, select, summary, input[type="range"], [data-ba-media]');
    cursor.classList.toggle('is-label', !!labeled && !hover);
    cursor.classList.toggle('is-hover', !!hover);
    label.textContent = labeled && !hover ? labeled.dataset.cursor : '';
  });

  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.28);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    });
  });

  $$('.bento__cell').forEach((cell) => {
    cell.addEventListener('pointermove', (e) => {
      const r = cell.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      cell.style.setProperty('--mx', `${px * 100}%`);
      cell.style.setProperty('--my', `${py * 100}%`);
      if (cell.hasAttribute('data-tilt')) {
        gsap.to(cell, { rotateY: (px - 0.5) * 6, rotateX: (0.5 - py) * 6, transformPerspective: 900, duration: 0.6, ease: 'power3' });
      }
    });
    cell.addEventListener('pointerleave', () => gsap.to(cell, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'power3' }));
  });
}

/* ---------------- medição (Google Tag Manager / GA4) ---------------- */
window.dataLayer = window.dataLayer || [];
function track(event, params = {}) {
  window.dataLayer.push({ event, ...params });
  logAnalytics(event, params);
  // evento recomendado do GA4 para leads (marque como evento-chave no Analytics)
  if (event === 'orcamento_enviado') logAnalytics('generate_lead', { method: params.canal });
}
function initTracking() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el) return;
    const section = el.closest('section, header, footer')?.id || el.closest('footer, header')?.tagName.toLowerCase() || 'pagina';
    const href = el.getAttribute('href') || '';
    if (el.matches('[data-wa-toggle]')) return; // abrir o widget não é um clique de WhatsApp
    if (href.includes('wa.me')) {
      track('whatsapp_click', { origem: el.dataset.waOrigin || el.dataset.track || section });
      return;
    }
    let label = el.dataset.track;
    if (!label) {
      if (href.startsWith('tel:')) label = 'telefone';
      else if (href.startsWith('mailto:')) label = 'email';
      else if (href === '#contato') label = 'cta_orcamento';
      else if (href.endsWith('.pdf')) label = 'download_pdf';
    }
    if (label) track('cta_click', { cta: label, secao: section });
  });
}

/* ---------------- toast, cópia, progresso ---------------- */
let toastTimer;
function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

function initCopy() {
  $$('.contact__list li').forEach((li) => {
    const link = $('a', li);
    if (!link || link.href.includes('wa.me')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = 'Copiar';
    btn.setAttribute('aria-label', `Copiar ${link.textContent}`);
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link.textContent.trim());
        toast(`${link.textContent.trim()} copiado`);
      } catch {
        toast('Não foi possível copiar');
      }
    });
    link.after(btn);
  });
}

function initProgress() {
  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<span></span>';
  document.body.appendChild(bar);
  gsap.to($('span', bar), { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
}

/* ---------------- guia → case relacionado ---------------- */
function initCaseLinks() {
  const rail = $('[data-cases]');
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-case-link]');
    if (!link || !rail) return;
    e.preventDefault();
    e.stopPropagation();
    const card = $(link.getAttribute('href'));
    scrollToTarget('#cases');
    setTimeout(() => {
      const pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      rail.scrollTo({ left: card.offsetLeft - pad, behavior: reduced ? 'auto' : 'smooth' });
      card.classList.remove('is-highlight');
      void card.offsetWidth;
      card.classList.add('is-highlight');
    }, lenis ? 1300 : 500);
  }, true);
}

/* ---------------- boot ---------------- */
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 150));

function boot() {
  // a seção com pin é criada primeiro para que os demais gatilhos considerem o espaço que ela ocupa
  initProcess();
  initNav();
  initCounters();
  initMarquees();
  initPointerFx();
  initTracking();
  initWhatsApp({ track, reduced, ScrollTrigger });
  initConsent();
  initProgress();

  // seções abaixo da dobra: inicializadas quando o navegador fica ocioso
  idle(() => {
    injectContextual();
    initServices();
    initSelector();
    initPanels();
    initCases();
    initCopy();
    initCaseLinks();
    const journey = $('[data-journey]');
    if (journey) initJourney(journey, { reduced });
    $$('[data-ba]').forEach((card) => initBeforeAfter(card, { reduced }));
    initMatrix($('#tecnologias'));
    const wizard = initWizard($('[data-wizard]'), { reduced, whatsapp: WHATSAPP, email: EMAIL, track, toast });
    initSimulator($('[data-sim]'), {
      reduced,
      onSend: (sim) => {
        wizard.attachSimulation(sim);
        track('simulacao_enviada', { economia: Math.round(sim.total) });
        scrollToTarget('#contato');
      },
      onWhatsApp: (sim) => {
        window.open(waUrl(`Olá, TFM! Fiz uma simulação no site e gostaria de avaliar a recuperação de uma peça.\n\n${sim.text}`), '_blank', 'noopener');
        track('whatsapp_click', { origem: 'simulador' });
        track('simulacao_enviada', { economia: Math.round(sim.total), canal: 'whatsapp' });
      },
    });
  });
  initSplits();
  initReveals();
  initTimeline();

  initSpray($('[data-spray]'), { reduced, getBounds: heroBounds });
  heroIntro();
  ScrollTrigger.refresh();
}

const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
const minDelay = new Promise((r) => setTimeout(r, reduced ? 0 : 400));
const timeout = new Promise((r) => setTimeout(r, 2500));
Promise.race([Promise.all([fontsReady, minDelay]), timeout]).then(boot);
