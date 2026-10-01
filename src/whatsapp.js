// Conversão para WhatsApp: links contextuais, widget com atalhos e barra fixa no mobile.
export const WHATSAPP = '5511950427669';

export const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="wa-ico"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.16-3.48-8.41Z"/></svg>';

export const waUrl = (message) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;

const QUICK = [
  { key: 'foto', label: 'Enviar foto de uma peça para avaliação', msg: 'Olá, tudo bem? Queria mandar umas fotos de uma peça para vocês avaliarem.' },
  { key: 'emergencia', label: 'Emergência: equipamento parado', msg: 'Olá! Estou com um equipamento parado e preciso de ajuda com urgência.' },
  { key: 'orcamento', label: 'Orçamento de recuperação ou revestimento', msg: 'Olá, tudo bem? Queria um orçamento para recuperar uma peça.' },
  { key: 'campo', label: 'Serviço de campo na minha planta', msg: 'Olá, tudo bem? Preciso de um serviço de campo aqui na nossa planta.' },
];


// Links estáticos marcados com data-wa="mensagem"
function wireStatic() {
  document.querySelectorAll('[data-wa]').forEach((el) => {
    el.href = waUrl(el.dataset.wa);
    el.target = '_blank';
    el.rel = 'noopener';
  });
}

function initWidget({ track, reduced }) {
  const root = document.querySelector('[data-wa-widget]');
  if (!root) return null;
  const toggle = root.querySelector('[data-wa-toggle]');
  const panel = root.querySelector('[data-wa-panel]');
  const list = root.querySelector('[data-wa-quick]');
  const form = root.querySelector('[data-wa-form]');
  const input = form.querySelector('input');
  const teaser = root.querySelector('[data-wa-teaser]');
  let open = false;
  let teaserTimer;

  QUICK.forEach((q) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = waUrl(q.msg);
    a.target = '_blank';
    a.rel = 'noopener';
    a.dataset.waOrigin = `widget_${q.key}`;
    a.innerHTML = `<span>${q.label}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
    a.addEventListener('click', () => setOpen(false));
    li.append(a);
    list.append(li);
  });

  const hideTeaser = () => {
    clearTimeout(teaserTimer);
    teaser.classList.remove('is-on');
  };

  function setOpen(value, { focus = true } = {}) {
    open = value;
    root.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    hideTeaser();
    if (open) {
      try { sessionStorage.setItem('tfm-wa-seen', '1'); } catch { /* ignore */ }
      track?.('whatsapp_widget_aberto');
      if (focus) requestAnimationFrame(() => list.querySelector('a')?.focus());
    } else if (focus) {
      toggle.focus();
    }
  }

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    setOpen(!open);
  });
  root.querySelector('[data-wa-close]').addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
  document.addEventListener('click', (e) => {
    if (open && !root.contains(e.target) && !e.target.closest('[data-wa-open]')) setOpen(false, { focus: false });
  });
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-wa-open]');
    if (!opener) return;
    e.preventDefault();
    setOpen(true);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    const msg = text ? `Olá! ${text}` : QUICK[0].msg;
    window.open(waUrl(msg), '_blank', 'noopener');
    track?.('whatsapp_click', { origem: 'widget_texto' });
    input.value = '';
    setOpen(false, { focus: false });
  });

  // convite discreto: uma vez por sessão, depois de algum engajamento
  let seen = false;
  try { seen = sessionStorage.getItem('tfm-wa-seen') === '1'; } catch { /* ignore */ }
  if (!seen && !reduced) {
    let engaged = false;
    const arm = () => {
      if (engaged || window.scrollY < 700) return;
      engaged = true;
      window.removeEventListener('scroll', arm);
      // espera o visitante responder ao aviso de cookies antes de convidar
      const tryShow = (attempt = 0) => {
        if (open) return;
        if (document.querySelector('.consent')) {
          if (attempt < 40) setTimeout(() => tryShow(attempt + 1), 3000);
          return;
        }
        teaser.classList.add('is-on');
        try { sessionStorage.setItem('tfm-wa-seen', '1'); } catch { /* ignore */ }
        teaserTimer = setTimeout(hideTeaser, 12000);
      };
      setTimeout(tryShow, 6000);
    };
    window.addEventListener('scroll', arm, { passive: true });
    arm(); // a página pode já abrir rolada (recarga) ou o visitante pode ter rolado antes do script
  }
  teaser.querySelector('[data-wa-teaser-close]').addEventListener('click', hideTeaser);
  teaser.querySelector('[data-wa-teaser-open]').addEventListener('click', () => setOpen(true));

  return { setOpen };
}

// Barra fixa no mobile: aparece depois do hero e some quando o orçamento está na tela
function initMobileBar({ ScrollTrigger }) {
  const bar = document.querySelector('[data-mbar]');
  if (!bar) return;
  let pastHero = false;
  let atContact = false;
  let state = null;
  const sync = () => {
    const on = pastHero && !atContact && !document.documentElement.classList.contains('menu-open');
    if (on === state) return;
    state = on;
    bar.classList.toggle('is-on', on);
    document.documentElement.classList.toggle('has-mbar', on);
  };
  ScrollTrigger.create({ trigger: '.hero', start: 'bottom 60%', end: 'max', onToggle: (self) => { pastHero = self.isActive; sync(); } });
  ScrollTrigger.create({ trigger: '#contato', start: 'top 85%', end: 'bottom top', onToggle: (self) => { atContact = self.isActive; sync(); } });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}

export function initWhatsApp({ track, reduced, ScrollTrigger }) {
  wireStatic();
  const widget = initWidget({ track, reduced });
  initMobileBar({ ScrollTrigger });
  return widget;
}
