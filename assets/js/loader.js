(function () {
  const loader = document.getElementById('page-loader');
  const img = loader.querySelector('.loader-image');

  const pulseDuration = 1200; // deve combaciare con CSS
  const pulseCount = 2;       // quante pulsazioni vuoi

  function hideLoader() {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  }

  // aspetta che la pagina sia caricata
  window.addEventListener('load', () => {
    // aspetta 2 pulsazioni complete
    setTimeout(hideLoader, pulseDuration * pulseCount);
  });
})();
