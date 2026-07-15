// ==UserScript==
// @name         Gemini URL Search Injector & Auto-Submit
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Enables searching Gemini directly via URL: https://gemini.google.com/app?q=your+query+here
// @author       Leonidas
// @match        https://gemini.google.com/app*
// @match        https://gemini.google.com/app?*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// NOTE: Add a search engine in browser with the following URL: https://gemini.google.com/app?q=%s

(function() {
    'use strict';

    // 1. Check if there's a 'q' or 'prompt' parameter in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || urlParams.get('prompt');

    if (!query) return; // Exit if there is no query in the URL

    console.log("[Gemini URL Search] Found query:", query);

    // 2. Clear query parameters from URL without reloading so they don't loop on refresh
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    // 3. Keep looking for the input box (Gemini's SPA takes a second to load)
    const findAndFillInput = setInterval(() => {
        // Try various selectors used by Gemini's dynamic rich-text editor
        const editor = document.querySelector('.ql-editor.textarea') ||
                       document.querySelector('rich-textarea') ||
                       document.querySelector('[contenteditable="true"]');

        if (editor) {
            clearInterval(findAndFillInput);
            injectText(editor, query);
        }
    }, 100);

    // 4. Inject text into Gemini's editor
    function injectText(editor, text) {
        editor.focus();

        // Handle rich text elements natively used by Gemini (Quill-editor based)
        editor.textContent = '';
        const lines = text.split('\n');
        lines.forEach((line) => {
            const p = document.createElement('p');
            p.textContent = line;
            editor.appendChild(p);
        });

        // Crucial: Dispatch 'input' events so Gemini's Angular/Quill framework detects the change
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        // 5. Wait for the send button to activate and trigger click
        const findAndClickSendButton = setInterval(() => {
            // Match any button that looks like a "Send" or "Submit" button
            const sendButton = document.querySelector('button[aria-label*="Send"], button[aria-label*="send"], button[aria-label*="Submit"], button[aria-label*="送信"]');

            if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
                clearInterval(findAndClickSendButton);
                setTimeout(() => {
                    sendButton.click();
                }, 100); // Tiny delay to ensure JavaScript binding has caught up
            }
        }, 100);

        // Timeout checking for send button after 8 seconds in case of UI lag
        setTimeout(() => {
            clearInterval(findAndClickSendButton);
        }, 8000);
    }
})();
