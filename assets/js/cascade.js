(function () {
  /* ================= CONFIG ================= */
  const CASCADE_CHILD_DELAY = 80; // ms
  const IO_THRESHOLD = 0.15;      // % visibilità richiesta
  const WAIT_AFTER_LOADER_MS = 50;
  const debug = true;             // metti false in produzione
  /* ========================================== */

  const log = (...a) => debug && console.log('[reveal]', ...a);
  const prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let observer = null;

  /* ---------- utils ---------- */

  function loaderFinished() {
    const loader = document.getElementById('page-loader');
    if (!loader) return true;
    const cs = getComputedStyle(loader);
    return (
      loader.classList.contains('hidden') ||
      cs.display === 'none' ||
      cs.visibility === 'hidden' ||
      parseFloat(cs.opacity) === 0
    );
  }

  function forceRepaint(el) {
    el && el.getBoundingClientRect();
  }

  /* ---------- reveal logic ---------- */

  function activateReveal(el) {
    if (!el || el.dataset.revealDone === 'true') return;

    el.dataset.revealDone = 'true';

    if (prefersReduced) {
      el.classList.add('active');
      return;
    }

    if (el.classList.contains('cascade')) {
      [...el.children].forEach((child, i) => {
        child.style.transitionDelay = `${i * CASCADE_CHILD_DELAY}ms`;
      });
      forceRepaint(el);
    }

    requestAnimationFrame(() => el.classList.add('active'));
  }

  /* ---------- observer ---------- */

  function createObserver() {
    if (observer) return observer;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;

          // 🛑 GUARDIA FONDAMENTALE
          if (!loaderFinished()) {
            log('ignoro entry (loader visibile)', el);
            return;
          }

          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= IO_THRESHOLD
          ) {
            log('activate', el);
            activateReveal(el);
            observer.unobserve(el);
          }
        });
      },
      { threshold: IO_THRESHOLD }
    );

    return observer;
  }

  function observeAll() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) {
      log('nessun .reveal trovato');
      return;
    }

    const obs = createObserver();
    items.forEach((el) => {
      if (el.dataset.revealDone === 'true') return;
      obs.observe(el);
    });

    // 🔍 check immediato per elementi già visibili
    requestAnimationFrame(() => {
      items.forEach((el) => {
        if (el.dataset.revealDone === 'true') return;
        const r = el.getBoundingClientRect();
        const visible = r.top < window.innerHeight && r.bottom > 0;
        if (visible && loaderFinished()) {
          log('visibile subito -> activate', el);
          activateReveal(el);
          obs.unobserve(el);
        }
      });
    });
  }

  /* ---------- start AFTER loader ---------- */

  function startAfterLoader() {
    if (loaderFinished()) {
      log('loader già finito -> start');
      setTimeout(observeAll, WAIT_AFTER_LOADER_MS);
      return;
    }

    window.addEventListener(
      'page-loader-finished',
      () => {
        log('page-loader-finished ricevuto');
        setTimeout(observeAll, WAIT_AFTER_LOADER_MS);
      },
      { once: true }
    );
  }

  document.addEventListener('DOMContentLoaded', startAfterLoader);
})();
