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
  const STABLE_MS   = 180;  // tempo minimo perché lo stato sia considerato stabile
  const EDGE_PX     = 4;    // tolleranza in pixel dal bordo per evitare toggle dovuti al "bordo"

  function initCascade(el) {
    if (el.classList.contains('cascade') && !el.dataset.cascadeInitialized) {
      [...el.children].forEach((child, i) => {
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

  // area-based ratio (più robusto)
  function computeVisibleRatio(entry) {
    const iR = entry.intersectionRect;
    const bR = entry.boundingClientRect;
    if (!iR || !bR) return 0;
    const visibleArea = iR.width * iR.height;
    const totalArea = bR.width * bR.height;
    if (totalArea === 0) return 0;
    return visibleArea / totalArea;
  }

  // è vicino al bordo viewport? (top/bottom)
  function isNearViewportEdge(bR) {
    // se rootBounds disponibile usalo, altrimenti window.innerHeight
    const vh = (window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0);
    // vicino al bordo superiore
    const nearTop = Math.abs(bR.top - 0) <= EDGE_PX;
    // vicino al bordo inferiore (attenzione: bR.bottom comparato con viewport height)
    const nearBottom = Math.abs(bR.bottom - vh) <= EDGE_PX;
    return nearTop || nearBottom;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;

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

      // se siamo vicini al bordo, IGNORA cambiamenti: evita flicker da "on the edge" 
      const bR = entry.boundingClientRect;
      if (bR && isNearViewportEdge(bR)) {
        // non modificare lastRequestedVisible o schedulare toggles mentre siamo sul bordo
        // (se vuoi loggare per debug, fallalo qui)
        return;
      }

      // hysteresis decision
      let shouldBeVisible;
      if (!el._revealState.visible) {
        shouldBeVisible = visibleRatio >= ENTER_RATIO || entry.isIntersecting && visibleRatio > 0;
      } else {
        shouldBeVisible = !(visibleRatio <= EXIT_RATIO || visibleRatio === 0);
      }

      // se lo stato desiderato è identico all'ultimo richiesto, non cambiare
      if (el._revealState.lastRequestedVisible === shouldBeVisible) return;

      // cancella timer precedente
      if (el._revealState.debounceTimer) {
        clearTimeout(el._revealState.debounceTimer);
        el._revealState.debounceTimer = null;
      }

      // conferma dopo STABLE_MS
      el._revealState.lastRequestedVisible = shouldBeVisible;
      el._revealState.debounceTimer = setTimeout(() => {
        el._revealState.debounceTimer = null;
        const currentRatio = el._revealState.lastRatio;

        // se di nuovo vicino al bordo al momento della conferma, abort
        const currentBR = el.getBoundingClientRect();
        if (currentBR && isNearViewportEdge(currentBR)) {
          el._revealState.lastRequestedVisible = el._revealState.visible;
          return;
        }

        if (shouldBeVisible) {
          if (currentRatio >= ENTER_RATIO || (entry.isIntersecting && currentRatio > 0)) {
            initCascade(el);
            el.classList.add('active');
            el._revealState.visible = true;
          } else {
            el._revealState.lastRequestedVisible = el._revealState.visible;
          }
        } else {
          if (currentRatio <= EXIT_RATIO || currentRatio === 0) {
            el.classList.remove('active');
            if (currentRatio === 0) clearCascade(el);
            el._revealState.visible = false;
          } else {
            el._revealState.lastRequestedVisible = el._revealState.visible;
          }
        }
      }, STABLE_MS);
    });
  }, {
    root: null,
    // puoi aumentare la margin inferiore per anticipare l'entrata e ridurre i casi "a metà"
    rootMargin: '0px 0px -20% 0px',
    threshold: [0, 0.25, 0.5, 0.75, 1]
  });

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
