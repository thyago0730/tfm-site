import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const STEP_SECONDS = 4.2;

// Jornada da peça: etapas clicáveis com troca de foto e avanço automático.
export function initJourney(root, { reduced }) {
  const frame = root.querySelector('[data-journey-frame]');
  const imgs = [...frame.querySelectorAll('img')];
  const steps = [...root.querySelectorAll('.jstep')];
  const count = root.querySelector('[data-journey-count]');
  let index = 0;
  let bar = null;
  let inView = false;
  let hovering = false;

  gsap.set(imgs, { opacity: 0, zIndex: 0 });
  gsap.set(imgs[0], { opacity: 1 });

  const syncPlayback = () => {
    if (!bar) return;
    if (inView && !hovering) bar.play();
    else bar.pause();
  };

  const runBar = () => {
    bar?.kill();
    steps.forEach((s) => gsap.set(s.querySelector('.jstep__bar i'), { scaleX: 0 }));
    const fill = steps[index].querySelector('.jstep__bar i');
    if (reduced) {
      gsap.set(fill, { scaleX: 1 });
      return;
    }
    bar = gsap.fromTo(fill, { scaleX: 0 }, {
      scaleX: 1,
      duration: STEP_SECONDS,
      ease: 'none',
      paused: true,
      onComplete: () => go((index + 1) % steps.length),
    });
    syncPlayback();
  };

  function go(i) {
    const prev = imgs[index];
    const next = imgs[i];
    steps[index].classList.remove('is-active');
    steps[index].removeAttribute('aria-current');
    steps[i].classList.add('is-active');
    steps[i].setAttribute('aria-current', 'step');
    count.textContent = String(i + 1).padStart(2, '0');

    if (prev !== next) {
      gsap.killTweensOf(imgs);
      imgs.forEach((img) => img !== prev && img !== next && gsap.set(img, { opacity: 0, zIndex: 0 }));
      if (reduced) {
        gsap.set(prev, { opacity: 0 });
        gsap.set(next, { opacity: 1 });
      } else {
        gsap.set(prev, { opacity: 1, zIndex: 0 });
        gsap.fromTo(next,
          { opacity: 1, zIndex: 1, clipPath: 'inset(0% 100% 0% 0%)', scale: 1.08 },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            scale: 1,
            duration: 1.1,
            ease: 'expo.inOut',
            onComplete: () => {
              gsap.set(prev, { opacity: 0 });
              gsap.set(next, { zIndex: 0, clearProps: 'clipPath' });
            },
          });
      }
    }
    index = i;
    runBar();
  }

  steps.forEach((step, i) => step.addEventListener('click', () => go(i)));
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; syncPlayback(); } });
  root.addEventListener('pointerleave', () => { hovering = false; syncPlayback(); });
  root.addEventListener('focusin', () => { hovering = true; syncPlayback(); });
  root.addEventListener('focusout', () => { hovering = false; syncPlayback(); });

  ScrollTrigger.create({
    trigger: root,
    start: 'top 70%',
    end: 'bottom 30%',
    onToggle: (self) => { inView = self.isActive; syncPlayback(); },
  });

  runBar();
}

// Comparativo antes/depois: botões, arraste e revelação ao entrar na tela.
export function initBeforeAfter(card, { reduced }) {
  const media = card.querySelector('[data-ba-media]');
  const handle = card.querySelector('.ba__handle');
  const tagBefore = card.querySelector('.ba__tag--before');
  const tagAfter = card.querySelector('.ba__tag--after');
  const buttons = [...card.querySelectorAll('[data-ba-show]')];
  const state = { pos: 100 };

  const apply = () => {
    media.style.setProperty('--pos', `${state.pos}%`);
    handle.style.opacity = state.pos > 1 && state.pos < 99 ? 1 : 0;
    tagBefore.style.opacity = state.pos > 12 ? 1 : 0;
    tagAfter.style.opacity = state.pos < 88 ? 1 : 0;
  };
  const setPressed = (after) => buttons.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.baShow === '1') === after)));
  const animateTo = (pos, delay = 0) => {
    gsap.killTweensOf(state);
    gsap.to(state, { pos, delay, duration: reduced ? 0 : 1.2, ease: 'expo.inOut', onUpdate: apply });
  };

  buttons.forEach((b) => b.addEventListener('click', () => {
    const after = b.dataset.baShow === '1';
    setPressed(after);
    animateTo(after ? 0 : 100);
  }));

  let dragging = false;
  const posFrom = (e) => {
    const r = media.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
  };
  media.addEventListener('pointerdown', (e) => {
    dragging = true;
    media.setPointerCapture(e.pointerId);
    gsap.killTweensOf(state);
    state.pos = posFrom(e);
    apply();
  });
  media.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.pos = posFrom(e);
    apply();
    setPressed(state.pos < 50);
  });
  const end = () => { dragging = false; };
  media.addEventListener('pointerup', end);
  media.addEventListener('pointercancel', end);

  apply();
  ScrollTrigger.create({
    trigger: card,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      setPressed(true);
      animateTo(0, 0.4);
    },
  });
}
