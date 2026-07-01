// ==UserScript==
// @name         Discord VirusTotal Link Scanner
// @namespace    https://example.com/
// @version      1.7
// @description  Scan only Discord message links with VirusTotal and show scan status
// @match        https://discord.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      www.virustotal.com
// ==/UserScript==

(function () {
  'use strict';

  const VT_BASE = 'https://www.virustotal.com/api/v3';
  const STORAGE_KEY = 'discord_vt_api_key';
  const cache = new Map();
  const activeToasts = new Map();

  let API_KEY = GM_getValue(STORAGE_KEY, '');

  function saveApiKey(key) {
    API_KEY = key.trim();
    GM_setValue(STORAGE_KEY, API_KEY);
  }

  function promptForApiKey() {
    const entered = prompt('Enter your VirusTotal API key:');
    if (entered && entered.trim()) {
      saveApiKey(entered);
      alert('VirusTotal API key saved.');
      return true;
    }
    alert('VirusTotal API key is required for scanning links.');
    return false;
  }

  GM_registerMenuCommand('Set / Change VirusTotal API key', () => {
    const entered = prompt('Enter your VirusTotal API key:', API_KEY || '');
    if (entered && entered.trim()) {
      saveApiKey(entered);
      alert('VirusTotal API key saved.');
    } else {
      alert('VirusTotal API key was not changed.');
    }
  });

  GM_registerMenuCommand('Clear VirusTotal API key', () => {
    if (confirm('Remove the saved VirusTotal API key?')) {
      GM_setValue(STORAGE_KEY, '');
      API_KEY = '';
      alert('VirusTotal API key cleared.');
    }
  });

  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function normalizeUrl(href) {
    try {
      const u = new URL(href, location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
    } catch {
      return null;
    }
  }

  function isMessageLink(a) {
    if (!a || a.tagName !== 'A') return false;
    const messageNode = a.closest('[id^="chat-messages-"], [class*="message"], [data-list-item-id^="chat-messages"]');
    return !!messageNode;
  }

  function request(method, url, data = null) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        data,
        headers: {
          'x-apikey': API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        onload: res => {
          try {
            resolve(JSON.parse(res.responseText));
          } catch {
            reject(new Error('Invalid VirusTotal response'));
          }
        },
        onerror: () => reject(new Error('Network request failed'))
      });
    });
  }

  function createToast(id, title, text, kind = 'info') {
    removeToast(id);

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      width: 320px;
      padding: 12px 14px;
      border-radius: 12px;
      background: ${kind === 'danger' ? '#5b1d1d' : kind === 'success' ? '#1f4d2e' : '#2b2d31'};
      color: white;
      z-index: 2147483647;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
    `;

    toast.innerHTML = `
      <div style="font-weight:700; margin-bottom:4px;">${title}</div>
      <div style="opacity:.92;">${text}</div>
    `;

    document.documentElement.appendChild(toast);
    activeToasts.set(id, toast);
  }

  function removeToast(id) {
    const el = activeToasts.get(id);
    if (el) el.remove();
    activeToasts.delete(id);
  }

  async function ensureApiKey() {
    if (API_KEY) return true;
    return promptForApiKey();
  }

  async function scanUrl(url) {
    if (!API_KEY) throw new Error('VirusTotal API key not set');
    if (cache.has(url)) return cache.get(url);

    const submit = await request('POST', `${VT_BASE}/urls`, `url=${encodeURIComponent(url)}`);
    const analysisId = submit?.data?.id;
    if (!analysisId) throw new Error('No analysis id returned');

    let result = null;
    for (let i = 0; i < 6; i++) {
      await wait(3000);
      result = await request('GET', `${VT_BASE}/analyses/${analysisId}`);
      if (result?.data?.attributes?.status === 'completed') break;
    }

    const stats = result?.data?.attributes?.stats || {};
    const verdict = {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0
    };

    cache.set(url, verdict);
    return verdict;
  }

  function showFinalModal(message, url, vtUrl, onOpen) {
    const old = document.getElementById('vt-modal');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'vt-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,.65);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      width: min(580px, calc(100vw - 32px));
      background: #2b2d31; color: #fff; border-radius: 12px;
      padding: 16px; font-family: Arial, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
    `;

    box.innerHTML = `
      <div style="font-size:16px; font-weight:700; margin-bottom:10px;">VirusTotal result</div>
      <div style="white-space:pre-wrap; line-height:1.4; margin-bottom:14px;">${message}</div>
      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button id="vt-copy" style="padding:8px 12px; border:0; border-radius:8px; cursor:pointer;">Copy URL</button>
        <button id="vt-vt" style="padding:8px 12px; border:0; border-radius:8px; cursor:pointer;">Open Link on Virustotal</button>
        <button id="vt-cancel" style="padding:8px 12px; border:0; border-radius:8px; cursor:pointer;">Cancel</button>
        <button id="vt-open" style="padding:8px 12px; border:0; border-radius:8px; cursor:pointer; background:#3ba55d; color:white;">Open</button>
      </div>
    `;

    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove();
    });

    box.querySelector('#vt-cancel').onclick = () => overlay.remove();
    box.querySelector('#vt-open').onclick = () => {
      overlay.remove();
      onOpen();
    };
    box.querySelector('#vt-copy').onclick = () => GM_setClipboard(url);
    box.querySelector('#vt-vt').onclick = () => window.open(vtUrl, '_blank', 'noopener,noreferrer');
  }

  async function processLink(url) {
    const toastId = 'vt-scan-toast';

    if (!(await ensureApiKey())) return;

    createToast(toastId, 'VirusTotal', 'Scanning link...', 'info');

    try {
      const verdict = await scanUrl(url);
      removeToast(toastId);

      const vtUrl = `https://www.virustotal.com/gui/search?query=${encodeURIComponent(url)}`;
      const msg =
        `URL: ${url}\n\n` +
        `Malicious: ${verdict.malicious}\n` +
        `Suspicious: ${verdict.suspicious}\n` +
        `Harmless: ${verdict.harmless}\n` +
        `Undetected: ${verdict.undetected}\n\n` +
        `VirusTotal is only one signal, not a guarantee.`;

      showFinalModal(msg, url, vtUrl, () => window.open(url, '_blank', 'noopener,noreferrer'));
    } catch (err) {
      removeToast(toastId);
      const vtUrl = `https://www.virustotal.com/gui/search?query=${encodeURIComponent(url)}`;
      showFinalModal(
        `Failed to scan link.\n\n${String(err.message || err)}`,
        url,
        vtUrl,
        () => window.open(url, '_blank', 'noopener,noreferrer')
      );
    }
  }

  document.addEventListener('click', e => {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (!isMessageLink(a)) return;

    const url = normalizeUrl(a.getAttribute('href'));
    if (!url) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    processLink(url);
  }, true);
})();
