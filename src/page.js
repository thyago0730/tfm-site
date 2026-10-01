// Entrada das páginas secundárias (privacidade, 404): só estilos e o ano.
import './styles.css';
import { initConsent } from './analytics.js';
import { initDropdowns } from './nav.js';
import { initExplode } from './explode.js';
import { initLaser } from './laser.js';

document.documentElement.classList.add('is-ready', 'is-loaded');
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

initConsent();
initDropdowns();
initExplode(document.querySelector('[data-explode]'));
initLaser(document.querySelector('[data-laser]'), { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
