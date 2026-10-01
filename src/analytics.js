// Google Analytics 4 via Firebase, carregado só após o consentimento (LGPD).
// A chave de API do Firebase para web é um identificador público; a segurança
// fica nas regras do projeto e na restrição de domínio da chave no Google Cloud.
const firebaseConfig = {
  apiKey: 'AIzaSyDCKNI4_6VWVR0TfktPKAx28KHb9c0Bqjw',
  authDomain: 'tfm-siteweb.firebaseapp.com',
  projectId: 'tfm-siteweb',
  storageBucket: 'tfm-siteweb.firebasestorage.app',
  messagingSenderId: '958880106291',
  appId: '1:958880106291:web:c4596f2b3a19565c082046',
  measurementId: 'G-70HNXXBTTW',
};

const STORAGE_KEY = 'tfm-consent';
let ready = null;
const queue = [];

function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* navegação privada: vale só para esta visita */
  }
}

function start() {
  if (ready) return ready;
  ready = (async () => {
    const [{ initializeApp }, { getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled }] = await Promise.all([
      import('firebase/app'),
      import('firebase/analytics'),
    ]);
    if (!(await isSupported())) return null;
    const analytics = getAnalytics(initializeApp(firebaseConfig));
    const send = (name, params) => logEvent(analytics, name, params);
    send.disable = () => setAnalyticsCollectionEnabled(analytics, false);
    send.enable = () => setAnalyticsCollectionEnabled(analytics, true);
    queue.splice(0).forEach(([name, params]) => send(name, params));
    return send;
  })().catch(() => null);
  return ready;
}

// Registra um evento; antes do consentimento os eventos ficam só na fila local.
export function logAnalytics(name, params = {}) {
  if (!ready) {
    if (queue.length < 50) queue.push([name, params]);
    return;
  }
  ready.then((send) => send?.(name, params));
}

function buildBanner() {
  const el = document.createElement('div');
  el.className = 'consent';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-label', 'Preferências de cookies');
  el.innerHTML = `
    <p>Usamos cookies de análise para entender como o site é usado e melhorar a sua experiência. <a href="/privacidade.html">Saiba mais</a>.</p>
    <div class="consent__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-consent="denied"><span>Recusar</span></button>
      <button type="button" class="btn btn--flame btn--sm" data-consent="granted"><span>Aceitar</span></button>
    </div>`;
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const value = btn.dataset.consent;
    saveConsent(value);
    if (value === 'granted') start().then((send) => send?.enable());
    else {
      queue.length = 0;
      ready?.then((send) => send?.disable());
    }
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 400);
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-on')));
  return el;
}

export function initConsent() {
  const consent = readConsent();
  if (consent === 'granted') start();
  else if (!consent) setTimeout(buildBanner, 2500);

  // link "Preferências de cookies" reabre o banner
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-consent-open]');
    if (!link) return;
    e.preventDefault();
    if (!document.querySelector('.consent')) buildBanner();
  });
}
