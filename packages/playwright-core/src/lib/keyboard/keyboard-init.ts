/**
 * Mobile keyboard mock init script — exported as a raw JS string.
 *
 * Injected into every Playwright browser context via `addInitScript()`.
 * Self-contained IIFE: renders a fake OSK, patches `visualViewport.height`,
 * handles focus polling and key highlighting.
 *
 * This is a direct port of the original browser-side keyboard mock — the
 * body of the template literal below is byte-identical to the source of
 * the legacy `keyboard-init.js` file (now deleted). `\` backticks and
 * `${` template-expression markers inside the body are escaped so the
 * outer TypeScript template literal parses correctly.
 */
export const KEYBOARD_INIT_SCRIPT: string = `/**
 * Mobile keyboard mock init script.
 * Injected into every page Playwright opens (via patcher).
 *
 * Self-installs: focusin → show + layout shift; focusout → hide + restore.
 * On real keydown/keyup (e.g. Playwright keyboard.type) → highlights the key.
 * Mocks visualViewport.height to simulate real OSK viewport shrink so the app's
 * useKeyboardFrame/useVirtualKeyboard detection still works.
 *
 * Idempotent: re-injection (e.g. on SPA navigation) is a no-op.
 */
(() => {
  if (window.__MOBILE_KEYBOARD_MOCK_INSTALLED__) return;
  window.__MOBILE_KEYBOARD_MOCK_INSTALLED__ = true;

  // Only render the keyboard in the top-level document; iframes should not
  // create their own keyboard overlays. The top-level poller still detects
  // focus inside same-origin iframes.
  if (window.self !== window.top) return;

  const KEYBOARD_HEIGHT = 300;
  const KB_ID = '__mock_mobile_keyboard__';
  let shiftOn = false;
  let numbersOn = false;
  let checkInterval = null;

  const LETTERS = [
    [
      { l: 'q', k: 'q' },
      { l: 'w', k: 'w' },
      { l: 'e', k: 'e' },
      { l: 'r', k: 'r' },
      { l: 't', k: 't' },
      { l: 'y', k: 'y' },
      { l: 'u', k: 'u' },
      { l: 'i', k: 'i' },
      { l: 'o', k: 'o' },
      { l: 'p', k: 'p' },
    ],
    [
      { l: 'a', k: 'a' },
      { l: 's', k: 's' },
      { l: 'd', k: 'd' },
      { l: 'f', k: 'f' },
      { l: 'g', k: 'g' },
      { l: 'h', k: 'h' },
      { l: 'j', k: 'j' },
      { l: 'k', k: 'k' },
      { l: 'l', k: 'l' },
    ],
    [
      { l: '⇧', k: 'Shift', t: 'shift' },
      { l: 'z', k: 'z' },
      { l: 'x', k: 'x' },
      { l: 'c', k: 'c' },
      { l: 'v', k: 'v' },
      { l: 'b', k: 'b' },
      { l: 'n', k: 'n' },
      { l: 'm', k: 'm' },
      { l: '⌫', k: 'Backspace', t: 'backspace' },
    ],
    [
      { l: '123', k: '123', t: 'mode' },
      { l: '🌐', k: 'Globe', t: 'globe' },
      { l: 'space', k: ' ', t: 'space', w: 5 },
      { l: 'return', k: 'Enter', t: 'return' },
    ],
  ];

  const NUMBERS = [
    [
      { l: '1', k: '1' },
      { l: '2', k: '2' },
      { l: '3', k: '3' },
      { l: '4', k: '4' },
      { l: '5', k: '5' },
      { l: '6', k: '6' },
      { l: '7', k: '7' },
      { l: '8', k: '8' },
      { l: '9', k: '9' },
      { l: '0', k: '0' },
    ],
    [
      { l: '-', k: '-' },
      { l: '/', k: '/' },
      { l: ':', k: ':' },
      { l: ';', k: ';' },
      { l: '(', k: '(' },
      { l: ')', k: ')' },
      { l: '$', k: '$' },
      { l: '&', k: '&' },
      { l: '@', k: '@' },
      { l: '"', k: '"' },
    ],
    [
      { l: '#+=', k: '#+=', t: 'mode' },
      { l: '.', k: '.' },
      { l: ',', k: ',' },
      { l: '?', k: '?' },
      { l: '!', k: '!' },
      { l: "'", k: "'" },
      { l: '⌫', k: 'Backspace', t: 'backspace' },
    ],
    [
      { l: 'ABC', k: 'ABC', t: 'mode' },
      { l: '🌐', k: 'Globe', t: 'globe' },
      { l: 'space', k: ' ', t: 'space', w: 5 },
      { l: 'return', k: 'Enter', t: 'return' },
    ],
  ];

  function buildKeyboardHTML() {
    const layout = numbersOn ? NUMBERS : LETTERS;
    const renderRow = (row) => {
      const keys = row
        .map((kdef) => {
          const isWide = kdef.w && kdef.w > 1;
          const w = isWide
            ? \`calc(\${kdef.w * 36}px + \${(kdef.w - 1) * 6}px)\`
            : '36px';
          const type = kdef.t ?? 'char';
          const label = kdef.l;
          return \`<div class="kb-key" data-key="\${kdef.k}" data-type="\${type}" style="width:\${w}">
          <span class="kb-key-label">\${label}</span>
        </div>\`;
        })
        .join('');
      return \`<div class="kb-row">\${keys}</div>\`;
    };
    return layout.map(renderRow).join('');
  }

  // ── Style & DOM ────────────────────────────────────────────────────────
  const STYLES = \`
    #\${KB_ID} {
      position: fixed;
      left: 0; right: 0;
      bottom: -\${KEYBOARD_HEIGHT}px;
      height: \${KEYBOARD_HEIGHT}px;
      background: linear-gradient(180deg, #d1d5db, #c4c8ce);
      z-index: 2147483647;
      pointer-events: auto;
      transition: bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-shadow: 0 -6px 20px rgba(0,0,0,0.15);
      padding: 8px 4px 16px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      user-select: none;
    }
    #\${KB_ID}.visible { bottom: 0; }
    #\${KB_ID} .kb-row {
      display: flex;
      justify-content: center;
      gap: 5px;
      margin-bottom: 6px;
    }
    #\${KB_ID} .kb-key {
      height: 42px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1c1c1e;
      font-size: 16px;
      font-weight: 400;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08), 0 0.5px 0 rgba(255,255,255,0.8) inset;
      flex: 1;
      max-width: 42px;
    }
    #\${KB_ID} .kb-key[data-type="symbol"] {
      background: #f2f3f5;
      font-size: 14px;
      max-width: 36px;
      height: 36px;
    }
    #\${KB_ID} .kb-key[data-type="action"] {
      background: #f2f3f5;
      font-size: 16px;
      max-width: 48px;
      height: 36px;
    }
    #\${KB_ID} .kb-key[data-type="shift"] {
      background: #aeb3be;
      color: #1c1c1e;
      max-width: 48px;
      font-size: 18px;
    }
    #\${KB_ID} .kb-key[data-type="shift"].active {
      background: #0a84ff;
      color: #fff;
      border-color: #0a84ff;
    }
    #\${KB_ID} .kb-key[data-type="backspace"] {
      background: #aeb3be;
      color: #1c1c1e;
      max-width: 48px;
      font-size: 18px;
    }
    #\${KB_ID} .kb-key[data-type="return"] {
      background: #0a84ff;
      color: #fff;
      border-color: #0a84ff;
      max-width: 88px;
      font-size: 14px;
      font-weight: 600;
    }
    #\${KB_ID} .kb-key[data-type="mode"] {
      background: #aeb3be;
      color: #1c1c1e;
      max-width: 48px;
      font-size: 13px;
      font-weight: 600;
    }
    #\${KB_ID} .kb-key[data-type="globe"] {
      background: #aeb3be;
      color: #1c1c1e;
      max-width: 42px;
      font-size: 16px;
    }
    #\${KB_ID} .kb-key[data-type="space"] {
      background: #ffffff;
      max-width: none;
      flex: 5;
    }
    #\${KB_ID} .kb-key.pressed {
      background: #8e8e93 !important;
      color: #fff;
      transform: translateY(1px);
      box-shadow: 0 0 1px rgba(0,0,0,0.1) inset;
    }
  \`;

  function install() {
    if (document.getElementById(KB_ID)) return;
    const style = document.createElement('style');
    style.id = \`\${KB_ID}_style\`;
    style.textContent = STYLES;
    document.head.appendChild(style);

    const kb = document.createElement('div');
    kb.id = KB_ID;
    kb.innerHTML = buildKeyboardHTML();
    document.body.appendChild(kb);
    window.__MOBILE_KB__ = kb;

    patchVisualViewport();
    startFocusPolling();
    wireKeyHighlight();
    new ResizeObserver(() => render()).observe(document.body);
  }

  function render() {
    const kb = window.__MOBILE_KB__;
    if (kb) kb.innerHTML = buildKeyboardHTML();
  }

  function patchVisualViewport() {
    const vp = window.visualViewport;
    if (!vp) return;
    Object.defineProperty(vp, 'height', {
      configurable: true,
      get() {
        if (window.__KEYBOARD_VISIBLE__)
          return Math.max(0, window.innerHeight - KEYBOARD_HEIGHT);
        return window.innerHeight;
      },
    });
  }

  // ── Editable detection ────────────────────────────────────────────────
  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase();
      return ![
        'radio',
        'checkbox',
        'submit',
        'button',
        'file',
        'color',
        'range',
        'reset',
        'image',
        'hidden',
      ].includes(t);
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function getFocusedElement(doc = document) {
    try {
      let active = doc.activeElement;
      if (!active) return null;
      if (active.tagName === 'IFRAME') {
        const innerDoc =
          active.contentDocument || active.contentWindow?.document;
        if (innerDoc) return getFocusedElement(innerDoc);
      }
      return active;
    } catch (_e) {
      return null;
    }
  }

  function hasEditableFocused(doc = document) {
    const active = getFocusedElement(doc);
    if (isEditable(active)) return true;
    // Also check all iframes recursively
    const iframes = doc.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const idoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (idoc && hasEditableFocused(idoc)) return true;
      } catch (_e) {}
    }
    return false;
  }

  // ── Show / hide ───────────────────────────────────────────────────────
  function showKeyboard() {
    if (window.__KEYBOARD_VISIBLE__) return;
    window.__KEYBOARD_VISIBLE__ = true;
    const kb = window.__MOBILE_KB__;
    if (kb) kb.classList.add('visible');

    if (!document.body.dataset.origPad) {
      const cs = window.getComputedStyle(document.body);
      document.body.dataset.origPad = parseFloat(
        cs.paddingBottom || '0'
      ).toString();
    }
    const origPad = parseFloat(document.body.dataset.origPad || '0');
    document.body.style.paddingBottom = \`\${origPad + KEYBOARD_HEIGHT}px\`;

    if (window.visualViewport)
      window.visualViewport.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }

  function hideKeyboard() {
    if (!window.__KEYBOARD_VISIBLE__) return;
    window.__KEYBOARD_VISIBLE__ = false;
    const kb = window.__MOBILE_KB__;
    if (kb) kb.classList.remove('visible');

    if (document.body.dataset.origPad) {
      document.body.style.paddingBottom = \`\${document.body.dataset.origPad}px\`;
    }
    if (window.visualViewport)
      window.visualViewport.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }

  // ── Polling-based focus detection ─────────────────────────────────────
  function startFocusPolling() {
    if (checkInterval) return;
    checkInterval = setInterval(() => {
      const focused = hasEditableFocused();
      if (focused && !window.__KEYBOARD_VISIBLE__) {
        showKeyboard();
      } else if (!focused && window.__KEYBOARD_VISIBLE__) {
        hideKeyboard();
      }
    }, 100);
  }

  // ── Key highlight + click handling ──────────────────────────────
  function wireKeyHighlight() {
    // Prevent focus steal when tapping anywhere on the keyboard (except return which dismisses)
    document.addEventListener(
      'pointerdown',
      (e) => {
        const kb = e.target.closest('#__mock_mobile_keyboard__');
        if (!kb) return; // Click is outside keyboard, do nothing
        // Only allow return key to propagate (will be handled by click handler)
        const key = e.target.closest('.kb-key');
        if (key && key.dataset.type === 'return') return;
        e.preventDefault();
      },
      true
    );

    document.addEventListener(
      'keydown',
      (e) => {
        if (!window.__KEYBOARD_VISIBLE__) return;
        const k = e.key;
        if (k === 'Shift') {
          shiftOn = true;
          paintShift();
        }
        if (k === '123') {
          numbersOn = true;
          render();
          return;
        }
        if (k === 'ABC' || k === '#+=') {
          numbersOn = false;
          render();
          return;
        }
        const target = findKeyByEvent(k, e);
        if (target) target.classList.add('pressed');
      },
      true
    );
    document.addEventListener(
      'keyup',
      (e) => {
        if (e.key === 'Shift') {
          shiftOn = false;
          paintShift();
        }
        const target = findKeyByEvent(e.key, e);
        if (target) {
          setTimeout(() => target.classList.remove('pressed'), 80);
        }
      },
      true
    );
    document.addEventListener(
      'click',
      (e) => {
        const key = e.target.closest('.kb-key');
        if (!key) return;
        const type = key.dataset.type;
        const k = key.dataset.key;
        if (type === 'return') {
          // Dismiss keyboard on return key
          const active = getFocusedElement();
          if (active && active !== document.body) active.blur();
          hideKeyboard();
          return;
        }
        if (type === 'mode') {
          numbersOn = !numbersOn;
          render();
          return;
        }
        if (type === 'globe') return;
        if (type === 'action') return;
      },
      true
    );
  }

  function findKeyByEvent(key, ev) {
    const kb = window.__MOBILE_KB__;
    if (!kb) return null;
    const specialMap = {
      Enter: 'Enter',
      Backspace: 'Backspace',
      ' ': ' ',
      Tab: 'Tab',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight',
    };
    const dataKey =
      specialMap[key] ?? (key.length === 1 ? key.toLowerCase() : null);
    if (!dataKey) return null;
    return kb.querySelector(\`.kb-key[data-key="\${cssEscape(dataKey)}"]\`);
  }

  function paintShift() {
    const kb = window.__MOBILE_KB__;
    if (!kb) return;
    const sh = kb.querySelector('.kb-key[data-type="shift"]');
    if (sh) sh.classList.toggle('active', shiftOn);
  }

  function cssEscape(s) {
    return String(s).replace(/[^\\w-]/g, (c) => \`\\\\\${c}\`);
  }

  // ── Install ────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
`;
