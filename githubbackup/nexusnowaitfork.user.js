// ==UserScript==
// @name        Nexus No Wait ++ (Fork)
// @description Skip countdowns, auto-start downloads, archived file support, and Nexus SPA fixes. Fork of Nexus No Wait ++ with UI + safety improvements.
// @version     2.1.2
// @namespace   NexusNoWaitPlusPlusFork
// @author      StrangeT (Orig) + Torkelicious + ShredGman
// @iconURL     https://raw.githubusercontent.com/torkelicious/nexus-no-wait-pp/refs/heads/main/icon.png
// @icon        https://raw.githubusercontent.com/torkelicious/nexus-no-wait-pp/refs/heads/main/icon.png
// @license      GPL-3.0-or-later
// @match        https://*.nexusmods.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @connect      nexusmods.com
// @downloadURL  https://raw.githubusercontent.com/alphaxleonidas/Scripts/main/githubbackup/nexusnowaitfork.user.js
// @updateURL    https://raw.githubusercontent.com/alphaxleonidas/Scripts/main/githubbackup/nexusnowaitfork.user.js
// ==/UserScript==


// backup: download url:  https://update.greasyfork.org/scripts/564332/Nexus%20No%20Wait%20%2B%2B%20%28Fork%29.user.js
// backup: update url:  https://update.greasyfork.org/scripts/564332/Nexus%20No%20Wait%20%2B%2B%20%28Fork%29.meta.js

(function () {
  'use strict'

  const SCRIPT_NAME = 'NexusNoWait++'
  const VERSION = GM_info?.script?.version || 'dev'

  // ────────────────────────────────────────────────
  // GM API fallbacks
  // ────────────────────────────────────────────────
  const GMX = {
    get:    (k, d) => typeof GM_getValue === 'function' ? GM_getValue(k, d) : d,
    set:    (k, v) => typeof GM_setValue === 'function' && GM_setValue(k, v),
    del:    (k) => typeof GM_deleteValue === 'function' && GM_deleteValue(k),
    style:  (css) => typeof GM_addStyle === 'function' && GM_addStyle(css),
  }

  const xhr = GM_xmlhttpRequest || (window.GM?.xmlHttpRequest) || null
  if (!xhr) {
    console.error(`[${SCRIPT_NAME}] GM_xmlhttpRequest missing`)
    return
  }

  // ────────────────────────────────────────────────
  // Config
  // ────────────────────────────────────────────────
  const CFG_PREFIX = 'nnwpp_'
  const DEFAULTS = {
    AutoStartDownload:   true,
    AutoCloseTab:        true,
    SkipRequirements:    true,
    ShowAlertsOnError:   true,
    HidePremiumUpsells:  true,
    HandleArchivedFiles: true,
    CloseTabDelay:       1800,
    RequestTimeout:      25000,
  }

  function loadConfig() {
    const cfg = { ...DEFAULTS }
    for (const k of Object.keys(DEFAULTS)) {
      const v = GMX.get(CFG_PREFIX + k, null)
      if (v !== null) cfg[k] = v === 'true' ? true : v === 'false' ? false : Number(v) || v
    }
    return cfg
  }

  let cfg = loadConfig()

  function save(key, value) {
    GMX.set(CFG_PREFIX + key, String(value))
    cfg[key] = value
  }

  // ────────────────────────────────────────────────
  // Logger
  // ────────────────────────────────────────────────
  const log = {
    debug: (...a) => console.debug(`[${SCRIPT_NAME} ${VERSION}]`, ...a),
    info:  (...a) => console.info (`[${SCRIPT_NAME} ${VERSION}]`, ...a),
    warn:  (...a) => console.warn (`[${SCRIPT_NAME} ${VERSION}]`, ...a),
    error: (...a) => console.error(`[${SCRIPT_NAME} ${VERSION}]`, ...a),
  }

  // ────────────────────────────────────────────────
  // Notifications (color-coded toasts)
  // ────────────────────────────────────────────────
  GMX.style(`
    .nnw-toast {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999999;
      padding: 10px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      min-width: 180px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    }
    .nnw-toast.show  { opacity: 1; transform: translateY(0); }
    .nnw-success     { background: #28a745; }
    .nnw-warning     { background: #ffc107; color: #212529; }
    .nnw-error       { background: #dc3545; }
  `)

  function notify(message, type = 'info') { // type: 'success' | 'warning' | 'error'
    const div = document.createElement('div')
    div.className = `nnw-toast nnw-${type}`
    div.textContent = message
    document.body.appendChild(div)

    setTimeout(() => div.classList.add('show'), 50)
    setTimeout(() => {
      div.classList.remove('show')
      setTimeout(() => div.remove(), 400)
    }, 2200)
  }

  // ────────────────────────────────────────────────
  // Hide Premium Upsells (CSS)
  // ────────────────────────────────────────────────
  function injectPremiumHider() {
    if (!cfg.HidePremiumUpsells) return

    GMX.style(`
      /* Common premium banners, upsells, go-premium prompts */
      [class*="premium-banner"],
      [class*="GetPremium"],
      [class*="premium-upsell"],
      [class*="upgrade-premium"],
      .premium-upsell,
      .premium-promo,
      .go-premium,
      [href*="premium"],
      [href*="/premium"],
      .premium-cta,
      .nexus-premium-ad,
      .premium-download-notice,
      .slow-download-upsell,
      .premium-speed-limit,
      .premium-teaser,
      .premium-feature-lock,
      /* Vortex-like in-page banners */
      .get-more-mods-bar,
      .premium-feature,
      /* Generic hiding for text containing "premium" in links/buttons */
      a[href*="premium"]:not([href*="account"]):not([href*="billing"]),
      button:contains("Premium"),
      div:contains("Go Premium"),
      div:contains("Unlock with Premium"),
      div:contains("Get Premium"),
      /* Sidebars, footers, headers with premium links */
      .sidebar-premium,
      footer .premium,
      header .premium {
        display: none !important;
      }
    `)

    // Also hide via JS if needed (some are dynamically added)
    const observer = new MutationObserver(() => {
      document.querySelectorAll(
        '[class*="premium"], [id*="premium"], [class*="upsell"], [class*="GetPremium"]'
      ).forEach(el => {
        if (el.textContent.toLowerCase().includes('premium') ||
            el.href?.includes('premium')) {
          el.style.display = 'none'
        }
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }

  // ────────────────────────────────────────────────
  // Network / Download logic (unchanged except notify calls)
  // ────────────────────────────────────────────────
  function request(opts) {
    return new Promise(resolve => {
      xhr({
        method:  'GET',
        timeout: cfg.RequestTimeout,
        ...opts,
        onload:  r => resolve(r),
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      })
    })
  }

  async function getDownloadUrl({ fileId, gameId = '', isNMM = false, fullHref = '' }) {
    if (!fileId) return { error: 'No file_id' }

    if (isNMM && fullHref) {
      const html = (await request({ url: fullHref }))?.responseText || ''
      const nxm = html.match(/nxm:\/\/[^\s"']+/i)?.[0]
      if (nxm) return { url: nxm }
    }

    const postData = `fid=${encodeURIComponent(fileId)}&game_id=${encodeURIComponent(gameId)}`

    const res = await request({
      method: 'POST',
      url: '/Core/Libs/Common/Managers/Downloads?GenerateDownloadUrl',
      data: postData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })

    if (!res?.responseText) return { error: 'Request failed' }

    let url = null
    try {
      url = JSON.parse(res.responseText)?.url?.replace(/&amp;/g, '&')
    } catch {}

    if (!url) {
      const m = res.responseText.match(/id=["']dl_link["'][^>]*value=["']([^"']+)/i)
      if (m) url = m[1].replace(/&amp;/g, '&')
    }

    return url ? { url } : { error: 'Could not extract download link (login?)' }
  }

  // ────────────────────────────────────────────────
  // Click handler with notifications
  // ────────────────────────────────────────────────
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[href], button')
    if (!a) return

    let href = a.href || a.getAttribute('href')
    if (!href) return

    const url = new URL(href, location.href)
    const fileId = url.searchParams.get('file_id') || url.searchParams.get('id')
    if (!fileId) return

    if (url.searchParams.has('requirements') && !cfg.SkipRequirements) return

    e.preventDefault()
    e.stopImmediatePropagation()

    const gameId = document.querySelector('[data-game-id]')?.dataset?.gameId || ''

    notify('Preparing download...', 'warning')

    const { url: dlUrl, error } = await getDownloadUrl({
      fileId,
      gameId,
      isNMM: url.searchParams.has('nmm'),
      fullHref: href,
    })

    if (dlUrl) {
      notify('Download started!', 'success')
      location.assign(dlUrl)
    } else if (error) {
      notify(`Error: ${error}`, 'error')
      if (cfg.ShowAlertsOnError) alert(`${SCRIPT_NAME}\n\n${error}`)
      log.error(error)
    }
  }, true)

  // ────────────────────────────────────────────────
  // Auto-start with notifications
  // ────────────────────────────────────────────────
  async function tryAutoStart() {
    if (!cfg.AutoStartDownload) return

    const p = new URLSearchParams(location.search)
    const fileId = p.get('file_id')
    if (!fileId) return

    const gameId = document.querySelector('[data-game-id]')?.dataset?.gameId || ''

    notify('Auto-starting download...', 'warning')

    const { url: dl, error } = await getDownloadUrl({
      fileId,
      gameId,
      isNMM: p.has('nmm'),
      fullHref: location.href,
    })

    if (dl) {
      notify('Download started!', 'success')
      location.assign(dl)
      if (cfg.AutoCloseTab) {
        setTimeout(() => window.close(), cfg.CloseTabDelay)
      }
    } else if (error) {
      notify(`Auto-start failed: ${error}`, 'error')
      if (cfg.ShowAlertsOnError) alert(error)
    }
  }

  // ────────────────────────────────────────────────
  // Archived files (unchanged)
  // ────────────────────────────────────────────────
  function patchArchivedFiles() {
    if (!cfg.HandleArchivedFiles) return
    if (!location.search.includes('archived')) return

    document.querySelectorAll('[data-file-id]:not([data-nnw-done])').forEach(el => {
      el.dataset.nnwDone = '1'
      const id = el.dataset.fileId
      const base = location.origin + location.pathname

      const div = document.createElement('div')
      div.className = 'nnw-archived-links'
      div.innerHTML = `
        <a href="${base}?file_id=${id}&nmm=1" class="btn small">Mod Manager</a>
        <a href="${base}?file_id=${id}"       class="btn small">Manual</a>
      `
      el.appendChild(div)
    })
  }

  // ────────────────────────────────────────────────
  // Settings panel (added new option)
  // ────────────────────────────────────────────────
  GMX.style(`
    #nnw-settings {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      background: #1e1e1e;
      color: #e0e0e0;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5);
      max-width: 260px;
    }
    #nnw-settings summary {
      cursor: pointer;
      font-weight: 600;
      user-select: none;
    }
    #nnw-settings label {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 6px 0 0;
      font-size: 12.5px;
    }
    #nnw-settings input[type="checkbox"] {
      accent-color: #ff6a00;
    }
  `)

  function injectSettings() {
    if (document.getElementById('nnw-settings')) return

    const box = document.createElement('details')
    box.id = 'nnw-settings'
    box.open = false

    let html = `<summary>Nexus No Wait ++ ${VERSION}</summary>`

    for (const [k, defVal] of Object.entries(DEFAULTS)) {
      if (typeof defVal !== 'boolean') continue
      html += `
        <label>
          <input type="checkbox" data-key="${k}" ${cfg[k] ? 'checked' : ''}>
          ${k.replace(/([A-Z])/g, ' $1')}
        </label>`
    }

    box.innerHTML = html

    box.addEventListener('change', e => {
      const el = e.target
      if (!el.dataset?.key) return
      save(el.dataset.key, el.checked)
      // Re-apply premium hider if toggled
      if (el.dataset.key === 'HidePremiumUpsells') {
        if (el.checked) injectPremiumHider()
        else location.reload() // simplest way to unhide
      }
    })

    document.body.appendChild(box)
  }

  // ────────────────────────────────────────────────
  // SPA navigation
  // ────────────────────────────────────────────────
  let lastLocation = location.href

  function onNavigate() {
    if (location.href === lastLocation) return
    lastLocation = location.href
    run()
  }

  const originalPush = history.pushState
  const originalReplace = history.replaceState

  history.pushState = function (...args) { originalPush.apply(this, args); onNavigate() }
  history.replaceState = function (...args) { originalReplace.apply(this, args); onNavigate() }

  window.addEventListener('popstate', onNavigate)
  window.addEventListener('hashchange', onNavigate)
  new MutationObserver(onNavigate).observe(document, { subtree: true, childList: true })

  // ────────────────────────────────────────────────
  // Main run
  // ────────────────────────────────────────────────
  function run() {
    tryAutoStart()
    patchArchivedFiles()
    injectSettings()
    injectPremiumHider() // apply on every page/nav
    log.debug('Running on', location.pathname)
  }

  run()
})();
