
// menu suspenso "Soluções": hover no desktop, clique/teclado em qualquer dispositivo
export function initDropdowns() {
  document.querySelectorAll('[data-dd]').forEach((dd) => {
    const btn = dd.querySelector('.dd__btn');
    const set = (open) => { dd.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
    // com mouse o hover já abre; o clique só garante aberto (não fecha sem querer)
    btn.addEventListener('click', () => set(matchMedia('(hover: hover)').matches ? true : !dd.classList.contains('is-open')));
    dd.addEventListener('mouseenter', () => matchMedia('(hover: hover)').matches && set(true));
    dd.addEventListener('mouseleave', () => matchMedia('(hover: hover)').matches && set(false));
    dd.addEventListener('focusout', (e) => { if (!dd.contains(e.relatedTarget)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dd.classList.contains('is-open')) { set(false); btn.focus(); } });
    document.addEventListener('click', (e) => { if (!dd.contains(e.target)) set(false); });
  });
}
