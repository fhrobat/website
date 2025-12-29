// smooth_toggle.js
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.smooth-toggle').forEach(details => {
    const content = details.querySelector('.smooth-content');
    if (!content) return;

    // lettura iniziale: se details è open, rendiamo content visibile
    content.style.overflow = 'hidden';
    content.style.height = details.open ? 'auto' : '0';
    content.style.opacity = details.open ? '1' : '0';

    // Assicuriamoci che padding-top/bottom siano a 0 quando chiuso per misurare correttamente
    if (!details.open) {
      content.style.paddingTop = '0';
      content.style.paddingBottom = '0';
    }

    details.addEventListener('toggle', () => {
      if (details.open) {
        // apertura: prima rendiamo i padding verticali come nel CSS (per includerli nel scrollHeight)
        const computedStyle = getComputedStyle(content);
        // ricaviamo il padding desiderato dal CSS (se volevi variare, impostalo qui)
        const padTop = parseFloat(computedStyle.paddingTop) || 0;
        const padBottom = parseFloat(computedStyle.paddingBottom) || 0;

        // impostiamo temporaneamente i padding in modo che scrollHeight li includa
        content.style.paddingTop = padTop + 'px';
        content.style.paddingBottom = padBottom + 'px';

        // ora misura e animazione
        content.style.height = content.scrollHeight + 'px';
        content.style.opacity = '1';

        const onEnd = function () {
          content.style.height = 'auto'; // permette contenuto dinamico
          content.removeEventListener('transitionend', onEnd);
        };
        content.addEventListener('transitionend', onEnd);

      } else {
        // chiusura: forziamo altezza corrente (px) prima di animare a 0
        const cur = content.scrollHeight;
        content.style.height = cur + 'px';

        // piccolo frame per permettere al browser di applicare il valore
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            content.style.height = '0';
            content.style.opacity = '0';
            // togli padding verticale per risparmiare spazio durante la chiusura
            content.style.paddingTop = '0';
            content.style.paddingBottom = '0';
          });
        });
      }
    });
  });
});
