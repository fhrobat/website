// theme-toggle.js (o dentro home.js)

const STORAGE_KEY = 'appearance';
const body = document.body;
const toggle = document.getElementById('theme-toggle');
const icon = document.getElementById('theme-icon');

if (toggle) {

  // ritorna true se il tema effettivo è dark
  const isSystemDark = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isEffectiveDark = (value) => {
    if (value === 'dark') return true;
    if (value === 'light') return false;
    return isSystemDark(); // auto
  };

  const updateIcon = (value) => {
    if (!icon) return;
    icon.textContent = isEffectiveDark(value) ? '☀️' : '🌙';
  };

  const apply = (value) => {
    body.setAttribute('a', value);
    updateIcon(value);
  };

  // inizializzazione
  const saved = localStorage.getItem(STORAGE_KEY);
  apply(saved === 'dark' || saved === 'light' ? saved : 'auto');

  // click = inverti
  toggle.addEventListener('click', () => {
    const current = body.getAttribute('a') || 'auto';
    const darkNow = isEffectiveDark(current);
    const next = darkNow ? 'light' : 'dark';

    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  });

  // doppio click = torna ad auto
  toggle.addEventListener('dblclick', () => {
    localStorage.removeItem(STORAGE_KEY);
    apply('auto');
  });

  // se cambia il tema di sistema e siamo in auto, aggiorna icona
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if ((body.getAttribute('a') || 'auto') === 'auto') {
        updateIcon('auto');
      }
    });
  }
}
