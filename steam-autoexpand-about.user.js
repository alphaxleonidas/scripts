
// ==UserScript==
// @name         Steam - Auto Expand About This Game
// @namespace    steam-auto-expand-about
// @version      1.0.0
// @description  Automatically expands About This Game on Steam
// @match        https://store.steampowered.com/app/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function expandAboutGame() {
        const about = document.querySelector('#aboutThisGame');

        if (!about) return;

        const container = about.closest(
            '.game_page_autocollapse_ctn'
        );

        if (!container) return;

        // Remove collapsed state
        container.classList.remove('collapsed');

        // Remove height restrictions
        about.style.maxHeight = 'none';
        about.style.height = 'auto';
        about.style.overflow = 'visible';

        // Remove READ MORE overlay
        const fade = container.querySelector(
            '.game_page_autocollapse_fade'
        );

        if (fade) {
            fade.style.display = 'none';
        }
    }

    // Initial expansion
    expandAboutGame();

    // Watch for dynamically loaded content
    const observer = new MutationObserver(expandAboutGame);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
