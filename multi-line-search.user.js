// ==UserScript==
// @name         Search Each Line in New Tab
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Select multiple lines of text, then use the "Search lines" button to open each line in a new tab (Google search).
// @author       Leonidas
// @match        *://www.youtube.com/*
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Create floating button
  const btn = document.createElement('button');
  btn.textContent = '🔍';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.padding = '8px 12px';
  btn.style.borderRadius = '6px';
  btn.style.border = '1px solid #ccc';
  btn.style.background = '#fff';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
  btn.style.font = '14px sans-serif';
  document.documentElement.appendChild(btn);

  btn.addEventListener('click', () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (!text) {
      alert('Select some text with multiple lines first.');
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      alert('No non-empty lines found in selection.');
      return;
    }

    // Open each line as a DuckDuckGo search in a new tab
    lines.forEach((line, i) => {
      const url = 'https://www.duckduckgo.com/search?q=' + encodeURIComponent(line);
      // Small delay to avoid browser throttling too many tabs at once
      setTimeout(() => {
        GM_openInTab(url, { active: i === 0, setParent: true });
      }, i * 150);
    });
  });

  // Optional: register a menu command in Tampermonkey/Greasemonkey
  GM_registerMenuCommand('Search selected lines in new tabs', () => {
    btn.click();
  });
})();
