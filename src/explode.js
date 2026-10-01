// Vista explodida da nacele (setor eólico): etapas com autoplay enquanto visível.
export function initExplode(root) {
  if (!root) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tabs = [...root.querySelectorAll('[data-ex-go]')];
  const texts = [...root.querySelectorAll('[data-ex-text]')];
  const N = tabs.length;
  let step = 0, timer = 0, user = false;

  const go = (n) => {
    step = (n + N) % N;
    root.dataset.step = step;
    tabs.forEach((t, i) => t.setAttribute('aria-selected', String(i === step)));
    texts.forEach((t, i) => (t.hidden = i !== step));
  };
  const stop = () => { user = true; clearInterval(timer); };
  tabs.forEach((t, i) => t.addEventListener('click', () => { stop(); go(i); }));
  root.querySelector('[data-ex-prev]').addEventListener('click', () => { stop(); go(step - 1); });
  root.querySelector('[data-ex-next]').addEventListener('click', () => { stop(); go(step + 1); });

  if (reduced) return;
  new IntersectionObserver(([e]) => {
    clearInterval(timer);
    if (e.isIntersecting && !user) timer = setInterval(() => go(step + 1), 3800);
  }, { threshold: 0.4 }).observe(root);
}
