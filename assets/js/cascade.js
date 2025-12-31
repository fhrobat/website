/**
 * cascade.js
 * Robust reveal + cascade animation controller
 *
 * - Si avvia SOLO dopo che il page-loader ha dispatchato 'page-loader-finished'
 *   (il tuo loader già lo fa). Ha fallback su window.load e timeout.
 * - Hysteresis: soglie diverse per entrare/uscire.
 * - Debounce: conferma dello stato dopo un breve intervallo (evita flicker dovuto a subpixel).
 * - Edge tolerance: ignoriamo trigger mentre l'elemento è entro pochi px dal bordo.
 * - Area-based visible ratio (più stabile di entry.intersectionRatio in alcuni casi).
 * - Rispetta prefers-reduced-motion (mostra subito tutto senza observer).
 *
 * Tarare i parametri in cima al file se necessario.
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
  const STARTUP_FALLBACK_MS = 8000; // se l'evento loader non arriva entro X ms, abortiamo il wait e iniziamo

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
    // applica transition-delay inline ai figli
    [...el.children].forEach((child, i) => {
      child.style.transitionDelay = `${i * 90}ms`;
      // assicurati che siano nello stato iniziale via CSS (opacity 0 / transform)
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
  // controlla top / bottom rispetto alla viewport (in px)
  // ===========================
  function isNearViewportEdgeRect(rect) {
    if (!rect) return false;
    const vh = (window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0);
    const nearTop = Math.abs(rect.top - 0) <= EDGE_PX;
    const nearBottom = Math.abs(rect.bottom - vh) <= EDGE_PX;
    return nearTop || nearBottom;
  }

  // ===========================
  // Observer callback (factory)
  // ===========================
  function createObserver() {
    // callback
    const cb = (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;

        // init stato persistente per ogni elemento
        if (!el._revealState) {
          el._revealState = {
            visible: false,                // attualmente considerato visibile
            lastRequestedVisible: null,    // stato desiderato in corso di conferma
            debounceTimer: null,           // id timeout
            lastRatio: 0                   // ultimo ratio calcolato
          };
        }

        const state = el._revealState;
        // calcola ratio in modo robusto
        const visibleRatio = computeVisibleRatio(entry);
        state.lastRatio = visibleRatio;

        // controllo bordo: se l'elemento è vicino al bordo, non cambiamo nulla
        // usiamo boundingClientRect dell'entry (se presente); altrimenti fallback a getBoundingClientRect()
        const bRect = entry.boundingClientRect || (el.getBoundingClientRect && el.getBoundingClientRect());
        if (bRect && isNearViewportEdgeRect(bRect)) {
          // non schedulare toggle mentre siamo nel bordo rumoroso
          return;
        }

        // determina lo stato desiderato usando hysteresis
        let shouldBeVisible;
        if (!state.visible) {
          shouldBeVisible = (visibleRatio >= ENTER_RATIO) || (entry.isIntersecting && visibleRatio > 0);
        } else {
          shouldBeVisible = !(visibleRatio <= EXIT_RATIO || visibleRatio === 0);
        }

        // se lo stato desiderato è identico all'ultimo richiesto, non fare nulla (evita ri-schedulazioni)
        if (state.lastRequestedVisible === shouldBeVisible) return;

        // cancella eventuale timer precedente
        if (state.debounceTimer) {
          clearTimeout(state.debounceTimer);
          state.debounceTimer = null;
        }

        // schedula la conferma dopo STABLE_MS
        state.lastRequestedVisible = shouldBeVisible;
        state.debounceTimer = setTimeout(() => {
          state.debounceTimer = null;
          const currentRatio = state.lastRatio;
          // ricontrolliamo la posizione attuale dell'elemento (potrebbe essere cambiata)
          const currentRect = el.getBoundingClientRect();
          if (currentRect && isNearViewportEdgeRect(currentRect)) {
            // se ora siamo sul bordo, annulliamo la richiesta
            state.lastRequestedVisible = state.visible;
            return;
          }

          if (shouldBeVisible) {
            if (currentRatio >= ENTER_RATIO || (entry.isIntersecting && currentRatio > 0)) {
              initCascade(el);
              el.classList.add('active');
              state.visible = true;
            } else {
              // non soddisfa più la condizione: reset lastRequestedVisible
              state.lastRequestedVisible = state.visible;
            }
          } else {
            if (currentRatio <= EXIT_RATIO || currentRatio === 0) {
              el.classList.remove('active');
              if (currentRatio === 0) clearCascade(el);
              state.visible = false;
            } else {
              // non soddisfa più la condizione di uscita: reset
              state.lastRequestedVisible = state.visible;
            }
          }
        }, STABLE_MS);
      });
    };

    // crea l'observer
    return new IntersectionObserver(cb, {
      root: null,
      rootMargin: OBSERVER_ROOT_MARGIN,
      threshold: THRESHOLDS
    });
  }

  // ===========================
  // initReveal: la funzione che crea l'observer e inizia ad osservare
  // ===========================
  function initReveal() {
    if (_revealInitialized) return; // idempotente
    _revealInitialized = true;

    // rispettiamo prefers-reduced-motion: show immediato e return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach(el => {
        // assicurati che cascade sia inizializzato per evitare salti visivi
        initCascade(el);
        el.classList.add('active');
      });
      return;
    }

    // fallback per browser vecchi
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(el => {
        initCascade(el);
        el.classList.add('active');
      });
      return;
    }

    const observer = createObserver();

    // osserva gli elementi .reveal attuali
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // supporto per elementi aggiunti dinamicamente: usiamo MutationObserver per osservare nuovi .reveal aggiunti al DOM
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // look for added nodes that may contain .reveal
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.classList && node.classList.contains('reveal')) {
            observer.observe(node);
          }
          // anche se un subtree è aggiunto, cerca .reveal dentro
          const reveals = node.querySelectorAll && node.querySelectorAll('.reveal');
          if (reveals && reveals.length) {
            reveals.forEach(el => observer.observe(el));
          }
        }
        // se nodi rimossi contengono reveal, puliamo eventuali timer/stati (non strettamente necessario)
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

    // osserva il body per aggiunte dinamiche (a basso costo se limitato)
    mo.observe(document.body, { childList: true, subtree: true });

    // supporto <details>: se viene aperto aggiungiamo il content all'observer
    document.addEventListener('toggle', (e) => {
      const details = e.target;
      if (details && details.tagName && details.tagName.toLowerCase() === 'details') {
        const content = details.querySelector('.smooth-content');
        if (content) {
          if (!content.classList.contains('reveal')) content.classList.add('reveal');
          observer.observe(content);
        }
      }
    }, true);

    // optional: espone un evento in caso serva sapere che il reveal è pronto
    window.dispatchEvent(new CustomEvent('revealInitialized'));
  }

  // ===========================
  // Start: aspetta la fine del page-loader, poi initReveal()
  // ===========================
  function startRevealAfterLoader() {
    // se è già stato inizializzato altrove, non fare nulla
    if (_revealInitialized) return;

    // se il body non ha la classe 'loading' il tuo loader probabilmente è già finito
    const loaderAlreadyFinished = !document.body.classList.contains('loading');

    if (loaderAlreadyFinished) {
      // avvia subito (micro delay per permettere micro-transizio
