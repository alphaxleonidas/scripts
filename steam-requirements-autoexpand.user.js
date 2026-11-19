
// ==UserScript==
// @name         Steam - Always Show System Requirements
// @namespace    steam-auto-expand
// @version      1.0.0
// @description  Automatically expands system requirements on all Steam game pages
// @match        https://store.steampowered.com/app/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function expandRequirements() {
        document.querySelectorAll(
            '.game_page_autocollapse_ctn'
        ).forEach(container => {

            // Only target system requirements
            if (!container.querySelector('.sys_req')) return;

            // Remove Steam's collapsed state
            container.classList.remove('collapsed');

            // Remove maximum height restriction
            const content = container.querySelector(
                '.game_page_autocollapse'
            );

            if (content) {
                content.style.maxHeight = 'none';
                content.style.height = 'auto';
                content.style.overflow = 'visible';
            }

            // Remove the READ MORE overlay
            const fade = container.querySelector(
                '.game_page_autocollapse_fade'
            );

            if (fade) {
                fade.style.display = 'none';
            }

        });
    }

    // Initial expansion
    expandRequirements();

    // Watch for dynamically loaded Steam content
    const observer = new MutationObserver(expandRequirements);

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
