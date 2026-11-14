// ==UserScript==
// @name         Steam Store: Fix middle-click scroll in top section with Scroll Anywhere
// @namespace    local.steam-scroll-fix
// @version      1.0.0
// @description  Stops .page_top_area from acting as a scroll container so scroll extensions (e.g. ScrollAnywhere) scroll the whole page instead of only the top section.
// @match        https://store.steampowered.com/app/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Why?
// Using Scroll Anywhere on a Steam Page leads to an unusual bug where a portion of steam game page scrolls becauuse of the overflow.
// This script aims to fix that issue.

(function () {
  'use strict';

  var STYLE_ID = 'steam-scroll-fix-style';

  // Cause (verified via console diagnostic): img.gameColor and img.gameTexture
  // inside .page_top_area overflow it by ~325px, so the container has
  // overflow:auto/hidden AND scrollHeight > clientHeight. Scroll extensions pick it
  // as the scroll target. overflow:visible removes it as a scroll container.
  var CSS = 'html body .page_top_area { overflow: visible !important; }';

  function inject() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  inject();

  // Safety net: if Steam's JS removes the style from <head>, put it back.
  // Observe only direct children of <html> and <head> (not the whole subtree)
  // so this stays cheap on a page with a lot of DOM churn.
  var observer = new MutationObserver(inject);
  observer.observe(document.documentElement, { childList: true });
  if (document.head) {
    observer.observe(document.head, { childList: true });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.head) observer.observe(document.head, { childList: true });
    }, { once: true });
  }
})();
