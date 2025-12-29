(function () {
  function openContent(content) {
    content.style.transition = 'height 300ms ease, opacity 200ms ease';
    content.style.height = content.scrollHeight + 'px';
    content.style.opacity = '1';
    function onEnd() {
      content.style.height = 'auto';
      content.removeEventListener('transitionend', onEnd);
    }
    content.addEventListener('transitionend', onEnd);
  }

  function closeContent(content) {
    const cur = content.scrollHeight;
    content.style.height = cur + 'px';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.height = '0';
        content.style.opacity = '0';
      });
    });
  }

  function initDetails(details) {
    const content = details.querySelector('.smooth-content');
    if (!content) return;

    content.style.overflow = 'hidden';
    content.style.opacity = details.hasAttribute('open') ? '1' : '0';
    content.style.height = details.hasAttribute('open') ? 'auto' : '0';

    details.addEventListener('toggle', () => {
      if (details.open) {
        openContent(content);
      } else {
        closeContent(content);
      }
    });
  }

  function initAll() {
    document.querySelectorAll('.smooth-toggle').forEach(initDetails);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  window.addEventListener('resize', () => {
    document.querySelectorAll('.smooth-toggle[open] .smooth-content').forEach(c => {
      if (c.style.height === 'auto' || getComputedStyle(c).height === 'auto') {
        c.style.height = c.scrollHeight + 'px';
        requestAnimationFrame(() => c.style.height = 'auto');
      }
    });
  });
})();
