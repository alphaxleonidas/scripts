// ==UserScript==
// @name         Twitch: block horizontal scroll
// @namespace    local.twitch.nohscroll
// @version      1.0.0
// @match        https://www.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // Layer 1: the player placeholder is wrapped in a scale(2) element (with a scale(0.5) child).
  // The transform makes it visually 2x wider than its layout box, which leaks into the scroller's
  // scrollable overflow. overflow: clip stops that without creating a scroll container.
  const style = document.createElement('style');
  style.textContent = `
    .channel-root__player { overflow: clip !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // Layer 2: if anything still moves the scroller horizontally
  // (focus, scrollIntoView, trackpad drift), snap it back.
  // overflow-x: hidden still allows programmatic scrolling, so CSS alone can't stop this.
  const SCROLLERS = '.root-scrollable, .root-scrollable__content';
  addEventListener('scroll', (e) => {
    const t = e.target;
    if (t instanceof Element && t.matches(SCROLLERS) && t.scrollLeft !== 0) {
      t.scrollLeft = 0;
    }
  }, true);
})();
