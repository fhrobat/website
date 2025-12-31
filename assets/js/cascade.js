(function () {
  // CONFIGURAZIONE
  const CASCADE_CHILD_DELAY = 80;   // ms di stagger per i figli
  const DEFAULT_WAIT_AFTER_LOADER_MS = 160; // ms di attesa dopo l'evento loader (aumenta se necessario)
  const EXTRA_CLEANUP_PADDING = 200; // ms extra per sicurezza
  const debug = false; // setta a true per vedere i log in console

  let revealRan = false;

  function log(...args) { if (debug) console.log('[reveal-after-loader]', ...args); }

  // prefer-reduced-motion
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // parse "700ms" or "0.7s" o più values separati da comma -> ritorna massimo in ms
  function parseTimeToMs(timeStr) {
    if (!timeStr) return 0;
    return Math.max(...timeStr.split(',')
      .map(s => s.trim())
      .map(s => {
        if (s.endsWith('ms')) return parseFloat(s);
        if (s.endsWith('s')) return parseFloat(s) * 1000;
        // fallback: numero puro
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
      })
    );
  }

  // calcola il massimo tempo di transition (duration + delay) tra elementi selezionati
  function getMaxTransitionTimeMs(rootSelector = '.reveal', childSelector = '.reveal.cascade > *') {
    let max = 0;
    try {
      const roots = Array.from(document.querySelectorAll(rootSelector));
      roots.forEach(root => {
        const csRoot = getComputedStyle(root);
        const rootDur = parseTimeToMs(csRoot.transitionDuration);
        const rootDelay = parseTimeToMs(csRoot.transitionDelay);
        max = Math.max(max, rootDur + rootDelay);

        // consideriamo anche i figli cascade
        if (root.classList.contains('cascade')) {
          const children = Array.from(root.querySelectorAll('*'));
          children.forEach((child, i) => {
            const cs = getComputedStyle(child);
            const dur = parseTimeToMs(cs.transitionDuration);
            const delay = parseTimeToMs(cs.transitionDelay);
            // aggiungiamo lo stagger che impostiamo inline (i * CASCADE_CHILD_DELAY)
            const total = dur + delay + (i * CASCADE_CHILD_DELAY);
            max = Math.max(max, total);
          });
        }
      });
    } catch (e) {
      log('errore calc transition times', e);
    }
    return max;
  }

  // forza repaint
  function forceRepaint(el) { if (!el) return; el.getBoundingClientRect(); }

  function runRevealOnce(waitAfterLoaderMs = DEFAULT_WAIT_AFTER_LOADER_MS) {
    if (revealRan) { log('already ran'); return; }
    revealRan = true;
    log('runRevealOnce - start');

    if (prefersReduced) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
      log('prefers-reduced-motion: activated all reveals immediately');
      return;
    }

    const reveals = Array.from(document.querySelectorAll('.reveal'));
    if (!reveals.length) {
      log('Nessun .reveal trovato al momento dell\'esecuzione');
      return;
    }

    // calcola cleanup dinamico
    const maxTransition = getMaxTransitionTimeMs();
    const cleanupTimeout = Math.ceil(maxTransition) + EXTRA_CLEANUP_PADDING;
    log('maxTransition (ms):', maxTransition, 'cleanupTimeout (ms):', cleanupTimeout);

    reveals.forEach(el => {
      if (el.classList.contains('cascade')) {
        const children = Array.from(el.children);
        children.forEach((child, i) => {
          child.style.transitionDelay = `${i * CASCADE_CHILD_DELAY}ms`;
        });
      }
      forceRepaint(el);
      requestAnimationFrame(() => el.classList.add('active'));
    });

    setTimeout(() => {
      document.querySelectorAll('.reveal.cascade > *').forEach(child => child.style.transitionDelay = '');
      log('cleanup: rimosso transitionDelay inline');
    }, cleanupTimeout);
  }

  // verifica se il loader è già stato nascosto
  function loaderAlreadyFinished() {
    const loader = document.getElementById('page-loader');
    if (!loader) {
      // controlla body.loading come fallback
      return !document.body.classList.contains('loading') || document.readyState === 'complete';
    }
    const cs = getComputedStyle(loader);
    return loader.classList.contains('hidden') || loader.classList.contains('done') || cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
  }

  // Hook evento page-loader-finished: gestisce casi in cui evento arriva prima/poi
  function hookToLoaderFinish() {
    // caso 1: già finito -> esegui subito (con micro-delay)
    if (loaderAlreadyFinished()) {
      log('loaderAlreadyFinished -> eseguo runRevealOnce after small delay');
      setTimeout(() => runRevealOnce(DEFAULT_WAIT_AFTER_LOADER_MS), DEFAULT_WAIT_AFTER_LOADER_MS);
      return;
    }

    // ascolto evento custom (il tuo finishPageLoader lo dispatcha)
    window.addEventListener('page-loader-finished', () => {
      log('evento page-loader-finished ricevuto');
      setTimeout(() => runRevealOnce(DEFAULT_WAIT_AFTER_LOADER_MS), DEFAULT_WAIT_AFTER_LOADER_MS);
    }, { once: true });

    // fallback su window.load
    window.addEventListener('load', () => {
      log('window.load ricevuto (fallback)');
      setTimeout(() => runRevealOnce(DEFAULT_WAIT_AFTER_LOADER_MS), DEFAULT_WAIT_AFTER_LOADER_MS);
    }, { once: true });

    // ulteriore guard su mutazioni del loader element
    const loaderEl = document.getElementById('page-loader');
    if (loaderEl) {
      const mo = new MutationObserver(() => {
        if (loaderAlreadyFinished()) {
          try { mo.disconnect(); } catch (e) {}
          log('MutationObserver: loader diventato hidden -> eseguo runRevealOnce');
          setTimeout(() => runRevealOnce(DEFAULT_WAIT_AFTER_LOADER_MS), DEFAULT_WAIT_AFTER_LOADER_MS);
        }
      });
      mo.observe(loaderEl, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }

  // inizializzazione
  document.addEventListener('DOMContentLoaded', hookToLoaderFinish);
})();
