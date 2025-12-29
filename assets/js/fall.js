// fall_chars_sync.clean.js
document.addEventListener('DOMContentLoaded', () => {
  const BTN_ID = 'trigger-fall';
  const SPLIT_SELECTORS = '#gravity-zone';
  const MAX_CHARS = 4000;

  let running = false;
  let timers = [];
  const originals = new Map();

  function clearTimers() {
    for (let t of timers) clearTimeout(t);
    timers.length = 0;
  }

  function cssVarNumber(varName, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varName) || '';
    const m = raw.match(/-?\d+/);
    if (!m) return fallback;
    const n = parseInt(m[0], 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function countTextCharsRecursively(node) {
    let count = 0;
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        count += (child.nodeValue || '').length;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName && child.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') return;
        count += countTextCharsRecursively(child);
      }
    });
    return count;
  }

  function replaceTextNodesWithSpans(node) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(txtNode) {
        if (!txtNode.nodeValue) return NodeFilter.FILTER_REJECT;
        // evita text inside script/style/noscript
        let p = txtNode.parentNode;
        while (p) {
          if (p.nodeType === Node.ELEMENT_NODE) {
            const tg = p.tagName && p.tagName.toLowerCase();
            if (tg === 'script' || tg === 'style' || tg === 'noscript') return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }, false);

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    for (let textNode of textNodes) {
      const text = textNode.nodeValue || '';
      if (text.length === 0) continue;
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(text)) {
        const span = document.createElement('span');
        span.className = 'fall-char';
        // RIPRISTINATO: usa NBSP per i caratteri spazio (come era prima)
        span.textContent = (ch === ' ') ? '\u00A0' : ch;
        frag.appendChild(span);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }

  function prepareChars(selectors) {
    const elements = Array.from(document.querySelectorAll(selectors));
    if (!elements.length) return { success: false, total: 0, processed: [] };

    let total = 0;
    const processed = [];

    for (const el of elements) {
      const c = countTextCharsRecursively(el);
      if (c === 0) continue;
      total += c;
      processed.push(el);
      if (total > MAX_CHARS) {
        // rollback immediato (nessun cambiamento persistente fatto comunque qui)
        return { success: false, total: 0, processed: [] };
      }
    }

    if (processed.length === 0) return { success: false, total: 0, processed: [] };

    // salva innerHTML e sostituisci text nodes
    for (const el of processed) {
      if (!originals.has(el)) originals.set(el, el.innerHTML);
      replaceTextNodesWithSpans(el);
    }

    return { success: true, total, processed };
  }

  function collectChars() {
    // non teniamo array globale: ne prendiamo al bisogno
    return document.querySelectorAll('.fall-char');
  }

  function popThenFallAll(chars) {
    if (!chars || !chars.length) return 0;
    const POP_MAX_DELAY = cssVarNumber('--char-pop-max-delay', 120);
    const popDuration = cssVarNumber('--char-pop-duration', 180);
    const fallDuration = cssVarNumber('--char-fall-duration', 1600);

    // calcola delay per ciascun char in modo deterministico al volo (no storage extra)
    const popDelays = Array.from(chars, () => Math.floor(Math.random() * POP_MAX_DELAY));

    popDelays.forEach((d, i) => {
      timers.push(setTimeout(() => {
        const ch = chars[i];
        if (ch) ch.classList.add('char-pop');
      }, d));
    });

    const maxPopDelay = Math.max(...popDelays);
    const maxPopEnd = maxPopDelay + popDuration + 20;

    timers.push(setTimeout(() => {
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (!ch) continue;
        const rot = (Math.random() * 40 + 8) * (Math.random() < 0.5 ? -1 : 1);
        ch.style.setProperty('--r', rot + 'deg');
        ch.classList.remove('char-pop');
        void ch.offsetWidth;
        ch.classList.remove('char-rise-active');
        ch.classList.add('char-fall-active');
      }
    }, maxPopEnd));

    return maxPopEnd + fallDuration;
  }

  function riseAllTogether(chars) {
    const riseDur = cssVarNumber('--char-rise-duration', 900);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      ch.classList.remove('char-fall-active');
      void ch.offsetWidth;
      ch.classList.add('char-rise-active');
    }
    return riseDur;
  }

  function cleanupAfter(chars) {
    // ripristina innerHTML dei container
    for (const [el, html] of originals.entries()) {
      try {
        el.innerHTML = html;
      } catch (e) {
        // ignore
      }
    }
    originals.clear();

    // rimuovi eventuali residui (se presenti ancora)
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      ch.classList.remove('char-pop','char-fall-active','char-rise-active');
      ch.style && ch.style.removeProperty('--r');
    }

    clearTimers();
    // rimuovi classe di "falling mode" che mette overflow:hidden e pointer-events sul gravity-zone
    document.documentElement.classList.remove('falling-mode');
    running = false;
  }

  function doFallSync() {
    if (running) return;
    running = true;
    clearTimers();

    // blocco overflow della pagina per evitare spazio bianco in basso durante l'animazione
    document.documentElement.classList.add('falling-mode');

    const prep = prepareChars(SPLIT_SELECTORS);
    if (!prep.success || prep.total === 0) {
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    const charsNodeList = collectChars();
    if (!charsNodeList || charsNodeList.length === 0) {
      document.documentElement.classList.remove('falling-mode');
      running = false;
      return;
    }

    // convert to static NodeList reference for consistent indexing during timeouts
    const chars = Array.prototype.slice.call(charsNodeList);

    const fallEndEst = popThenFallAll(chars);

    // sincronizza rise con la fine stimata della caduta
    const riseTriggerDelay = fallEndEst;

    // schedule rise
    timers.push(setTimeout(() => {
      const riseDur = riseAllTogether(chars);
      timers.push(setTimeout(() => {
        cleanupAfter(chars);
      }, riseDur + 40));
    }, riseTriggerDelay));
  }

  // bind triggers (bottone e tasto 'f')
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.addEventListener('click', () => { if (!running) doFallSync(); });
  document.addEventListener('keydown', e => { if (e.key === 'f' && !running) doFallSync(); });

  // pulizia se l'utente lascia la pagina
  window.addEventListener('beforeunload', () => {
    clearTimers();
    originals.clear();
    running = false;
  });
});
