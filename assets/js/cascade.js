(function() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('active'));
    return;
  }

  // Parametri da tarare
  const ENTER_RATIO = 0.30; // quando consideriamo "entrato" (30% visibile)
  const EXIT_RATIO  = 0.08; // quando consideriamo "uscito" (8% visibile)
  const STABLE_MS   = 120;  // tempo minimo perché lo stato sia considerato stabile

  function initCascade(el) {
    if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
      [...el.children].forEach((child, i) => {
        // imposta delay solo una volta
        child.style.transitionDelay = `${i * 90}ms`;
      });
      el.dataset.cascadeInitialized = '1';
    }
  }

  function clearCascade(el) {
    if (el.classList.contains('cascade') && el.dataset.cascadeInitialized) {
      [...el.children].forEach(child => {
        child.style.transitionDelay = '';
      });
      delete el.dataset.cascadeInitialized;
    }
  }

  // helper: calcola ratio visibile in modo più robusto (verticale o orizzontale)
  function computeVisibleRatio(entry) {
    const iR = entry.intersectionRect;
    const bR = entry.boundingClientRect;
    if (!iR || !bR) return 0;
    // se l'elemento è più largo che alto potresti voler guardare la larghezza; qui usiamo aree
    const visibleArea = iR.width * iR.height;
    const totalArea = bR.width * bR.height;
    if (totalArea === 0) return 0;
    return visibleArea / totalArea;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

      // stato persistente
      if (!el._revealState) {
        el._revealState = {
          visible: false,
          lastRequestedVisible: null,
          debounceTimer: null,
          lastRatio: 0
        };
      }

      const visibleRatio = computeVisibleRatio(entry);
      el._revealState.lastRatio = visibleRatio;

      // decide il desiderio di stato usando hysteresis
      let shouldBeVisible;
      if (!el._revealState.visible) {
        // non visibile -> diventiamo visibili solo se raggiungiamo ENTER_RATIO
        shouldBeVisible = visibleRatio >= ENTER_RATIO || entry.isIntersecting && visibleRatio > 0;
      } else {
        // già visibile -> restiamo tali finché non scendiamo sotto EXIT_RATIO
        shouldBeVisible = !(visibleRatio <= EXIT_RATIO || visibleRatio === 0);
      }

      // se lo stato desiderato è già quello richiesto precedentemente, non fare nulla
      if (el._revealState.lastRequestedVisible === shouldBeVisible) {
        // già in corso di conferma, lascia stare
        return;
      }

      // cancella timer precedente
      if (el._revealState.debounceTimer) {
        clearTimeout(el._revealState.debounceTimer);
        el._revealState.debounceTimer = null;
      }

      // pianifica conferma dopo STABLE_MS
      el._revealState.lastRequestedVisible = shouldBeVisible;
      el._revealState.debounceTimer = setTimeout(() => {
        el._revealState.debounceTimer = null;
        // ricontrolla ratio attuale: se è cambiato troppo, annulla
        // (riduce possibilità di toggles dovuti a fluttuazioni rapide)
        const currentRatio = el._revealState.lastRatio;
        if (shouldBeVisible) {
          if (currentRatio >= ENTER_RATIO || (entry.isIntersecting && currentRatio > 0)) {
            // show
            initCascade(el);
            el.classList.add('active');
            el._revealState.visible = true;
          }
        } else {
          if (currentRatio <= EXIT_RATIO || currentRatio === 0) {
            // hide
            el.classList.remove('active');
            if (currentRatio === 0) clearCascade(el);
            el._revealState.visible = false;
          } else {
            // se non soddisfa più la condizione di uscita, resetta lastRequestedVisible
            el._revealState.lastRequestedVisible = el._revealState.visible;
          }
        }
      }, STABLE_MS);
    });
  }, {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    // una lista di threshold più semplice riduce chiamate inutili; con hysteresis non servono tanti valori
    threshold: [0, 0.25, 0.5, 0.75, 1]
  });

  // osserva tutti gli .reveal
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // supporto <details>
  document.addEventListener('toggle', (e) => {
    const details = e.target;
    if (details.tagName && details.tagName.toLowerCase() === 'details') {
      const content = details.querySelector('.smooth-content');
      if (content) {
        if (!content.classList.contains('reveal')) content.classList.add('reveal');
        observer.observe(content);
      }
    }
  }, true);

})();
