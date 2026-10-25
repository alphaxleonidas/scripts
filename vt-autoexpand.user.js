// ==UserScript==
// @name         VirusTotal Auto-Expand Everything
// @namespace    https://www.virustotal.com/
// @version      2.0.0
// @description  Auto-expands <vt-ui-expandable-detail>, <vt-ui-expand-button>, other aria-expanded toggles and "Load more" buttons on VirusTotal, including content nested in shadow roots and anything newly unlocked.
// @match        https://www.virustotal.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------------- Config ----------------
  const DEBUG = false;                  // true = log what the script does to the console
  const SCAN_DEBOUNCE_MS = 150;         // wait for DOM bursts to settle before scanning
  const FALLBACK_INTERVAL_MS = 2000;    // catches shadow roots/attributes that appear without a visible mutation
  const VERIFY_MS = 800;                // wait this long for a toggle to flip before trying the next activation method
  const EXPAND_GENERIC_ARIA = true;     // also click any other [aria-expanded="false"] (menus/dropdowns/nav are excluded)

  const LOAD_MORE_QUIET_MS = 600;       // the list must stop changing this long after a page rendered before the next click
  const LOAD_MORE_MIN_GAP_MS = 1000;    // minimum time between two clicks on the same button
  const LOAD_MORE_TIMEOUT_MS = 4000;    // no DOM change this long after a click = that click did nothing
  const LOAD_MORE_MAX_FAILS = 3;        // give up on a button after this many do-nothing clicks
  const LOAD_MORE_MAX_CLICKS = 100;     // safety cap per page URL, protects you from huge lists / API rate limits

  // ---------------- Selectors ----------------
  const SEL_DETAIL = 'vt-ui-expandable-detail';
  const TAG_EXPAND_BUTTON = 'vt-ui-expand-button';
  const SEL_LOAD_MORE = 'button.btn-load-more, button[aria-label="Load more" i]';
  const SEL_ROW = 'vt-ui-file-list-expandable-row';
  const SEL_NOT_EXPANDABLE_UI =
    '[aria-haspopup]:not([aria-haspopup="false"]), .dropdown-toggle, [data-bs-toggle="dropdown"], ' +
    '[role="menuitem"], [role="tab"], [role="combobox"], ' +
    'nav *, [role="navigation"] *, [role="menu"] *, [role="menubar"] *';

  // ---------------- State ----------------
  const handled = new WeakSet();        // elements already expanded once, so a manual collapse sticks
  const watched = new WeakSet();        // roots that already have a MutationObserver
  const lmState = new WeakMap();        // load-more button -> { last, fails }
  const lmGaveUp = new WeakSet();
  const lmPending = new Set();          // load-more buttons being driven right now
  const lmClicksByUrl = new Map();
  let scanTimer = null;
  let lmTimer = null;
  const rootInfo = new WeakMap();       // root -> { seq, last }: counts node additions/removals (not attribute changes)

  const log = (...a) => { if (DEBUG) console.log('[VT auto-expand]', ...a); };

  // ---------------- <vt-ui-expandable-detail> ----------------
  function expandDetail(el) {
    if (handled.has(el)) return;
    handled.add(el);
    if (el.hasAttribute('opened') || el.opened === true) return;
    el.setAttribute('opened', '');
    if ('opened' in el && el.opened !== true) el.opened = true;     // fallback if only the property is wired up
    log('detail opened', el);
  }

  // ---------------- aria-expanded toggles (vt-ui-expand-button & co) ----------------
  const key = (type, init) => new KeyboardEvent(type, Object.assign({ bubbles: true, composed: true, cancelable: true }, init));
  const STRATEGIES = [
    el => el.click(),
    el => { el.dispatchEvent(key('keydown', { key: 'Enter', code: 'Enter' })); el.dispatchEvent(key('keyup', { key: 'Enter', code: 'Enter' })); },
    el => { el.dispatchEvent(key('keydown', { key: ' ', code: 'Space' })); el.dispatchEvent(key('keyup', { key: ' ', code: 'Space' })); },
    el => { const inner = el.shadowRoot && el.shadowRoot.querySelector('button, [role="button"], a'); if (inner) inner.click(); },
  ];

  function activate(el) {
    let i = 0;
    const step = () => {
      if (!el.isConnected || el.getAttribute('aria-expanded') !== 'false') { log('toggle open', el); return; }
      if (i >= STRATEGIES.length) { log('toggle would not open, gave up', el); return; }
      log('toggle strategy', i, el);
      STRATEGIES[i++](el);
      setTimeout(step, VERIFY_MS);
    };
    step();
  }

  function handleToggle(el) {
    if (handled.has(el)) return;
    const state = el.getAttribute('aria-expanded');
    if (state !== 'true' && state !== 'false') return;              // not rendered yet, a later scan retries
    if (el.localName !== TAG_EXPAND_BUTTON) {
      if (!EXPAND_GENERIC_ARIA || el.matches(SEL_NOT_EXPANDABLE_UI)) return;
    }
    handled.add(el);
    if (state === 'true') return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    activate(el);
  }

  // ---------------- "Load more" ----------------
  const visible = el => el.getClientRects().length > 0;

  function pumpLoadMore() {
    lmTimer = null;
    const now = Date.now();
    const url = location.href;
    for (const el of Array.from(lmPending)) {
      const clicks = lmClicksByUrl.get(url) || 0;
      if (!el.isConnected || !visible(el) || el.disabled || lmGaveUp.has(el) || clicks >= LOAD_MORE_MAX_CLICKS) {
        lmPending.delete(el);                                       // a later scan re-adds it if it comes back
        continue;
      }
      if (el.getAttribute('aria-busy') === 'true') continue;
      const info = rootInfo.get(el.getRootNode()) || { seq: 0, last: 0 };
      const st = lmState.get(el) || { last: 0, seq: 0, fails: 0 };
      const waited = now - st.last;
      const progressed = info.seq > st.seq;                        // nodes were added/removed next to the button since our last click
      const ready = st.last === 0 ||
        (progressed && waited >= LOAD_MORE_MIN_GAP_MS && now - info.last >= LOAD_MORE_QUIET_MS) ||
        waited >= LOAD_MORE_TIMEOUT_MS;
      if (!ready) continue;                                        // previous click still loading
      if (st.last > 0) {
        if (progressed) st.fails = 0;
        else if (++st.fails >= LOAD_MORE_MAX_FAILS) { lmGaveUp.add(el); lmPending.delete(el); log('load more: gave up', el); continue; }
      }
      st.last = now;
      st.seq = info.seq;
      lmState.set(el, st);
      lmClicksByUrl.set(url, clicks + 1);
      log('load more click #' + (clicks + 1), el);
      el.click();
    }
    if (lmPending.size) lmTimer = setTimeout(pumpLoadMore, 250);
  }

  function handleLoadMore(el) {
    if (lmGaveUp.has(el) || lmPending.has(el) || !visible(el) || el.disabled) return;
    lmPending.add(el);
    if (lmTimer === null) lmTimer = setTimeout(pumpLoadMore, 0);
  }

  // ---------------- Scanning ----------------
  function watch(root) {
    if (watched.has(root)) return;
    watched.add(root);
    const info = { seq: 0, last: 0 };
    rootInfo.set(root, info);
    new MutationObserver(records => {
      if (records.some(r => r.type === 'childList')) { info.seq++; info.last = Date.now(); }
      schedule();
    }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
  }

  function scan(root) {
    watch(root);
    root.querySelectorAll(SEL_DETAIL).forEach(expandDetail);
    root.querySelectorAll('[aria-expanded]').forEach(handleToggle);
    root.querySelectorAll(SEL_LOAD_MORE).forEach(handleLoadMore);
    if (DEBUG) {
      root.querySelectorAll(SEL_ROW + ':not([no-expand])').forEach(r => {
        if (!handled.has(r)) { handled.add(r); log('expandable row without no-expand (no known toggle handled here):', r); }
      });
    }
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) scan(el.shadowRoot);
    }
  }

  function schedule() {
    if (scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      try { scan(document); } catch (e) { console.error('[VT auto-expand]', e); }
    }, SCAN_DEBOUNCE_MS);
  }

  schedule();
  setInterval(schedule, FALLBACK_INTERVAL_MS);
})();
