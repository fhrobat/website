/**
 * cascade.js
 * Robust reveal + cascade animation controller
 *
 * - Avvia solo dopo 'page-loader-finished' (il tuo loader dispatcha questo evento).
 * - Hysteresis: soglie diverse per entrare/uscire.
 * - Debounce: conferma dopo un breve intervallo per evitare flicker.
 * - Edge tolerance: ignora toggles quando l'elemento è entro pochi px dal bordo viewport.
 * - Area-based visible ratio (più stabile in molti casi).
 * - Gestione dettagli (<details>) che re-inizializza/ri-osserva i figli.
 * - Rispetto di prefers-reduced-motion.
 *
 * Parametri tarabili nella sezione CONFIG.
 */

(function () {
  'use strict';

  // ===========================
  // CONFIG (tarabili)
  // ===========================
  const ENTER_RATIO = 0.30;   // ratio minimo per "entrata" (30% visibile)
  const EXIT_RATIO = 0.08;    // ratio massimo per considerare "uscito" (8% visibile)
  const STABLE_MS = 180;      // ms: conferma dopo che la condizione è stabile
  const EDGE_PX = 6;          // px: tolleranza dal bordo viewport per ignorare toggles
  const OBSERVER_ROOT_MARGIN = '0px 0px -20% 0px'; // anticipa l'entrata
  const THRESHOLDS = [0, 0.25, 0.5, 0.75, 1]; // semplificata per meno chatter
  const STARTUP_FALLBACK_MS = 8000; // se l'evento loader non arriva entro X ms, inizializziamo lo stesso

  // ===========================
  // Stato dell'init (idempotenza)
  // ===========================
  let _revealInitialized = false;

  // ===========================
  // HELPERS: cascade init/clear
  // ===========================
  function initCascade(el) {
    if (!el.classList.contains('cascade')) return;
    if (el.dataset.cascadeInitialized) return; // solo una volta
    [...el.children].forEach((child, i) => {
      child.style.transitionDelay = `${i * 90}ms`;
    });
    el.dataset.cascadeInitialized = '1';
  }

  function clearCascade(el) {
    if (!el.classList.contains('cascade')) return;
    if (!el.dataset.cascadeInitialized) return;
    [...el.children].forEach(child => {
      child.style.transitionDelay = '';
    });
    delete el.dataset.cascadeInitialized;
  }

  // ===========================
  // Helper: area-based visible ratio
  // ===========================
  function computeVisibleRatio(entry) {
    const iR = entry.intersectionRect;
    const bR = entry.boundingClientRect;
    if (!iR || !bR) return 0;
    const visibleArea = iR.width * iR.height;
    const totalArea = bR.width * bR.height;
    if (totalArea === 0) return 0;
    return visibleArea / totalArea;
  }

  // ===========================
  // Helper: vicino al bordo viewport?
  // ===========================
  function isNearViewportEdgeRect(rect) {
    if (!rect) return false;
    const vh = (window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0);
    const nearTop = Math.abs(rect.top - 0) <= EDGE_PX;
    const nearBottom = Math.abs(rect.bottom - vh) <= EDGE_PX;
    return nearTop || nearBottom;
  }

  // ===========================
  // Observer factory (crea observer e callback)
  // ===========================
  function createObserver() {
    let cb = (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;

        // init stato persistente per ogni elemento
        if (!el._revealState) {
          el._revealState = {
            visible: false,
            lastRequestedVisible: null,
            debounceTimer: null,
            lastRatio: 0
          };
        }
        const state = el._revealState;

        const visibleRatio = computeVisibleRatio(entry);
        state.lastRatio = visibleRatio;

        // controllo bordo: se l'elemento è vicino al bordo, non cambiamo stato
        const bRect = entry.boundingClientRect || (el.getBoundingClientRect && el.getBoundingClientRect());
        if (bRect && isNearViewportEdgeRect(bRect)) {
          return; // ignore mentre siamo nel bordo rumoroso
        }

        // determina lo stato desiderato usando hysteresis
        let shouldBeVisible;
        if (!state.visible) {
          shouldBeVisible = (visibleRatio >= ENTER_RATIO) || (entry.isIntersecting && visibleRatio > 0);
        } else {
          shouldBeVisible = !(visibleRatio <= EXIT_RATIO || visibleRatio === 0);
        }

        // se lo stato desiderato è identico all'ultimo richiesto, non fare nulla
        if (state.lastRequestedVisible === shouldBeVisible) return;

        // cancella timer precedente
        if (state.debounceTimer) {
          clearTimeout(state.debounceTimer);
          state.debounceTimer = null;
        }

        // schedula conferma
        state.lastRequestedVisible = shouldBeVisible;
        state.debounceTimer = setTimeout(() => {
          state.debounceTimer = null;
          const currentRatio = state.lastRatio;
          const currentRect = el.getBoundingClientRect();
          if (currentRect && isNearViewportEdgeRect(currentRect)) {
            state.lastRequestedVisible = state.visible;
            return;
          }

          if (shouldBeVisible) {
            if (currentRatio >= ENTER_RATIO || (entry.isIntersecting && currentRatio > 0)) {
              initCascade(el);
              el.classList.add('active');
              state.visible = true;
            } else {
              state.lastRequestedVisible = state.visible;
            }
          } else {
            if (currentRatio <= EXIT_RATIO || currentRatio === 0) {
              el.classList.remove('active');
              if (currentRatio === 0) clearCascade(el);
              state.visible = false;
            } else {
              state.lastRequestedVisible = state.visible;
            }
          }
        }, STABLE_MS);
      });
    };

    return new IntersectionObserver(cb, {
      root: null,
      rootMargin: OBSERVER_ROOT_MARGIN,
      threshold: THRESHOLDS
    });
  }

  // ===========================
  // initReveal: crea observer, osserva .reveal e installa handlers
  // ===========================
  function initReveal() {
    if (_revealInitialized) return;
    _revealInitialized = true;

    // prefers-reduced-motion: mostra subito tutto
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(el => {
        initCascade(el);
        el.classList.add('active');
      });
      window.dispatchEvent(new CustomEvent('revealInitialized'));
      return;
    }

    // se IntersectionObserver non esiste -> mostra tutto
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(el => {
        initCascade(el);
        el.classList.add('active');
      });
      window.dispatchEvent(new CustomEvent('revealInitialized'));
      return;
    }

    const observer = createObserver();

    // osserva gli elementi .reveal esistenti
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // MutationObserver per elementi aggiunti dinamicamente (osserva body subtree)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList && node.classList.contains('reveal')) {
            observer.observe(node);
          }
          const reveals = node.querySelectorAll && node.querySelectorAll('.reveal');
          if (reveals && reveals.length) {
            reveals.forEach(el => observer.observe(el));
          }
        }
        for (const node of m.removedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList && node.classList.contains('reveal') && node._revealState) {
            if (node._revealState.debounceTimer) {
              clearTimeout(node._revealState.debounceTimer);
              node._revealState.debounceTimer = null;
            }
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // ===========================
    // Gestione <details> - reinit dei reveal figli quando si apre/chiude
    // ===========================
    document.addEventListener('toggle', (e) => {
      const details = e.target;
      if (!details || !details.tagName || details.tagName.toLowerCase() !== 'details') return;

      // contenuto target: preferiamo .smooth-content, altrimenti l'intero details
      const content = details.querySelector('.smooth-content') || details;
      if (!content) return;

      const reveals = content.matches && content.matches('.reveal') ? [content] : Array.from(content.querySelectorAll('.reveal'));
      if (!reveals.length) return;

      // funzione che resetta lo stato interno degli elementi reveal
      function resetRevealState(el) {
        if (el._revealState) {
          if (el._revealState.debounceTimer) {
            clearTimeout(el._revealState.debounceTimer);
            el._revealState.debounceTimer = null;
          }
          el._revealState.visible = false;
          el._revealState.lastRequestedVisible = null;
          el._revealState.lastRatio = 0;
        }
      }

      if (details.open) {
        // apertura: rimuovo active e cascadeInitialized in modo che la prossima comparsa sia "fresca"
        reveals.forEach(el => {
          el.classList.remove('active');
          if (el.dataset && el.dataset.cascadeInitialized) {
            [...el.children].forEach(child => child.style.transitionDelay = '');
            delete el.dataset.cascadeInitialized;
          }
          resetRevealState(el);
        });

        // aspettiamo qualche frame per lasciare rifare il layout al browser, poi re-observe
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            reveals.forEach(el => {
              try { observer.unobserve(el); } catch (err) { /* noop */ }
              observer.observe(el);
            });
          });
        });

        // se vuoi attendere una transizione di apertura, puoi ascoltare content.addEventListener('transitionend', ...)
      } else {
        // chiusura: pulisco stato e rimuovo active, opzionale unobserve
        reveals.forEach(el => {
          resetRevealState(el);
          el.classList.remove('active');
          if (el.dataset && el.dataset.cascadeInitialized) {
            [...el.children].forEach(child => child.style.transitionDelay = '');
            delete el.dataset.cascadeInitialized;
          }
          try { observer.unobserve(el); } catch (err) { /* noop */ }
        });
      }
    }, true);

    // segnalazione che reveal è pronto
    window.dispatchEvent(new CustomEvent('revealInitialized'));
  }

  // ===========================
  // Start: aspetta la fine del page-loader, poi initReveal()
  // ===========================
  function startRevealAfterLoader() {
    if (_revealInitialized) return;

    const loaderAlreadyFinished = !document.body.classList.contains('loading');
    if (loaderAlreadyFinished) {
      setTimeout(initReveal, 60); // micro-delay per lasciare finire micro-transizioni
      return;
    }

    let settled = false;
    function settleNow() {
      if (settled) return;
      settled = true;
      setTimeout(initReveal, 80); // piccolo delay per lasciare finire fade-out del loader
    }

    const onFinished = function () {
      window.removeEventListener('page-loader-finished', onFinished);
      settleNow();
    };
    window.addEventListener('page-loader-finished', onFinished, { once: true });

    const onWinLoad = function () {
      window.removeEventListener('load', onWinLoad);
      settleNow();
    };
    window.addEventListener('load', onWinLoad, { once: true });

    setTimeout(() => {
      if (!settled) settleNow();
    }, STARTUP_FALLBACK_MS);
  }

  // Avvio
  startRevealAfterLoader();

  // ===========================
  // API utile per debug/forzatura
  // ===========================
  window.startCascadeNow = function () {
    startRevealAfterLoader();
    if (!_revealInitialized) initReveal();
  };

})();
