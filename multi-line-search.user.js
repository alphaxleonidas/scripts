// ==UserScript==
// @name         Search Each Line in New Tab
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Select multiple lines of text, then click the button to open each line in a new DuckDuckGo search tab. Works only on youtube.com (not embedded players). Button adapts to light/dark system theme. Cleans timestamps and list numbering from selected text.
// @author       Leonidas
// @match        *://www.youtube.com/*
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Stop if we're inside an embedded player (iframe)
  if (window.top !== window.self) return;

  // --- Theme‑adaptive styles ---
  const style = document.createElement('style');
  style.textContent = `
    #search-lines-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font: 14px sans-serif;
      border: 1px solid;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      /* Light theme (default) */
      background: rgba(255, 255, 255, 0.85);
      color: #000;
      border-color: #ccc;
    }

    @media (prefers-color-scheme: dark) {
      #search-lines-btn {
        background: rgba(40, 40, 40, 0.9);
        color: #eee;
        border-color: #555;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      }
    }
  `;
  document.head.appendChild(style);

  // --- Create the button ---
  const btn = document.createElement('button');
  btn.id = 'search-lines-btn';
  btn.textContent = '🔍';
  document.documentElement.appendChild(btn);

  // --- Text cleaning function (robust) ---
  function cleanLine(line) {
    let cleaned = line;

    // 1. Remove timestamps like 01:12, 1:23:45, etc.
    cleaned = cleaned.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '');

    // 2. Repeatedly strip leading enumeration patterns like "12 - ", "12.", "12)", "12: "
    //    Also handles leftover separators (dashes, spaces, dots) before the number.
    let previous;
    do {
      previous = cleaned;
      cleaned = cleaned.replace(/^[\s-–—.]*\d+\s*[-–—.:)]\s*/, '');
    } while (cleaned !== previous);

    // 3. Trim any remaining leading/trailing separators and whitespace
    cleaned = cleaned.replace(/^[-–—.\s]+/, '');
    cleaned = cleaned.replace(/[-–—.\s]+$/, '');

    return cleaned.trim();
  }

  // --- Click logic ---
  btn.addEventListener('click', () => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (!text) {
      alert('Select some text with multiple lines first.');
      return;
    }

    let lines = text.split(/\r?\n/)
      .map(l => cleanLine(l))
      .filter(l => l.length > 0);

    if (lines.length === 0) {
      alert('No text remaining after cleaning.');
      return;
    }

    // Open each line as a DuckDuckGo search (adding " steam") in a new tab
    lines.forEach((line, i) => {
      // Edit this line to change the search query:
      const url = 'https://www.duckduckgo.com/search?q=' + encodeURIComponent(line + ' steam');
      setTimeout(() => {
        GM_openInTab(url, { active: i === 0, setParent: true });
      }, i * 150);
    });
  });

  // Optional Tampermonkey menu command
  GM_registerMenuCommand('Search selected lines in new tabs', () => {
    btn.click();
  });
})();
