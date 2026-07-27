// ==UserScript==
// @name         URLVoid Instant Clean Redirect
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Instantly strips protocols, www, and encoding from URLVoid scan paths before the page loads.
// @author       Leonidas
// @match        https://www.urlvoid.com/scan/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    try {
        let currentUrl = window.location.href;
        let pathname = window.location.pathname;
        
        // Extract the target part after /scan/
        let prefixMatch = pathname.match(/\/scan\/(.*)/);
        if (!prefixMatch) return;
        
        let targetPart = prefixMatch[1];
        let decodedTarget = targetPart;

        // Decode if it's percent-encoded (e.g., https%3A%2F%2F...)
        if (targetPart.includes('%')) {
            try {
                decodedTarget = decodeURIComponent(targetPart);
            } catch (e) {
                // Keep original if decoding fails
            }
        }

        // Strip https://, http://, and www.
        let cleanedTarget = decodedTarget.replace(/https?:\/\/(?:www\.)?/gi, '');

        // If the cleaned target is different from what's currently in the URL, redirect instantly
        if (cleanedTarget !== targetPart && cleanedTarget !== decodedTarget) {
            // Reconstruct the clean URL
            let newUrl = currentUrl.replace(targetPart, encodeURIComponent(cleanedTarget));
            
            // Perform instant replacement so it doesn't leave a history trail of the messy URL
            window.location.replace(newUrl);
        }
    } catch (e) {
        console.error("URLVoid Cleaner Error: ", e);
    }
})();
