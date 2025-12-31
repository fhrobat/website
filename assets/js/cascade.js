(function () {
  const CASCADE_CHILD_DELAY = 80; // ms
  let revealRan = false;

  const prefersReduced =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function runRevealOnce() {
    if (revealRan) return;
    revealRan = true;

    if (prefersReduced) {
      document.querySelectorAll('.reveal').forEach(el =>
        el.classList.add('active')
      );
      return;
    }

    document.querySelectorAll('.reveal').forEach(el => {
      if (el.classList.contains('cascade')) {
        [...el.children].forEach((child, i) => {
          child.style.transitionDelay = `${i * CASCADE_CHILD_DELAY}ms`;
        });
      }
      el.getBoundingClientRect(); // force repaint
      requestAnimationFrame(() => el.classList.add('active'));
    });

    // pulizia delay inline
    setTimeout(() => {
      document
        .querySelectorAll('.reveal.cascade > *')
        .forEach(el => (el.style.transitionDelay = ''));
    }, 2000);
  }

  // ▶️ PARTE SOLO DOPO IL LOADER
  window.addEventListener(
    'page-loader-finished',
    () => setTimeout(runRevealOnce, 60),
    { once: true }
  );

  // fallback sicurezza
  window.addEventListener(
    'load',
    () => setTimeout(runRevealOnce, 100),
    { once: true }
  );
})();
