(function () {
  // CONFIG: tieni questi valori sincronizzati con lo SCSS
  const pulseDuration = 700;  // ms -> deve corrispondere a loader-pulse
  const pulseCount = 2;        // quante pulsazioni aspettare prima di nascondere

  // lock / unlock page scroll
  function lockPageScroll() {
    document.documentElement.classList.add('no-scroll');
    document.body.classList.add('no-scroll');
  }
  function unlockPageScroll() {
    document.documentElement.classList.remove('no-scroll');
    document.body.classList.remove('no-scroll');
  }

  // inizializza: flag loading e blocco scroll subito
  document.body.classList.add('loading');
  lockPageScroll();

  // definisci finishPageLoader se non esiste già
  if (typeof window.finishPageLoader !== 'function') {
    window.finishPageLoader = function finishPageLoader() {
      const loaderEl = document.getElementById('page-loader');
      if (loaderEl) {
        loaderEl.classList.add('hidden');
        loaderEl.setAttribute('aria-hidden', 'true');
      }
      // sblocca scroll PRIMA di rimuovere la flag loading
      unlockPageScroll();
      document.body.classList.remove('loading');

      // dispatch evento per altri script (es. observer)
      window.dispatchEvent(new CustomEvent('page-loader-finished'));
    };
  }

  // quando la pagina ha finito il caricamento, aspetta pulseCount pulsazioni e chiama finishPageLoader
  function onLoadFinish() {
    const delay = pulseDuration * pulseCount;
    setTimeout(() => {
      if (typeof window.finishPageLoader === 'function') window.finishPageLoader();
    }, delay);
  }

  if (document.readyState === 'complete') {
    onLoadFinish();
  } else {
    window.addEventListener('load', onLoadFinish, { once: true });
  }

  // fallback: se l'utente preferisce ridotte animazioni, skip loader e sblocca
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // nascondi loader subito (se presente)
    const loaderEl = document.getElementById('page-loader');
    if (loaderEl) {
      loaderEl.classList.add('hidden');
      loaderEl.setAttribute('aria-hidden', 'true');
    }
    unlockPageScroll();
    document.body.classList.remove('loading');
    window.dispatchEvent(new CustomEvent('page-loader-finished'));
  }

})();
