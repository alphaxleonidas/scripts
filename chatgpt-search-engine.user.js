// ==UserScript==
// @name         ChatGPT URL Search Injector & Auto-Submit
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Allows searching ChatGPT directly via URL: https://chatgpt.com/?q=your+query
// @author       Leonidas
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// NOTE: Add a search engine in browser with the following URL: https://chatgpt.com/?q=%s


(function() {
    'use strict';

    // 1. Get the 'q' or 'prompt' parameter from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || urlParams.get('prompt');

    if (!query) return; // Exit if no query parameter is found

    console.log("[ChatGPT URL Search] Found query:", query);

    // 2. Clear the query params from the URL bar immediately so refreshing doesn't loop
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

    // 3. Keep looking for ChatGPT's contenteditable/textarea input field
    const findAndFillInput = setInterval(() => {
        // ChatGPT typically uses a contenteditable div or a textarea (like #prompt-textarea)
        const textbox = document.querySelector('#prompt-textarea') ||
                        document.querySelector('[contenteditable="true"]');

        if (textbox) {
            clearInterval(findAndFillInput);
            injectTextAndSubmit(textbox, query);
        }
    }, 100);

    // 4. Inject text and simulate natural keyboard input for React
    function injectTextAndSubmit(textbox, text) {
        textbox.focus();

        // If it's a contenteditable element
        if (textbox.tagName !== 'TEXTAREA') {
            textbox.innerHTML = '';
            const p = document.createElement('p');
            p.textContent = text;
            textbox.appendChild(p);
        } else {
            // Fallback for standard textarea
            textbox.value = text;
        }

        // ChatGPT uses React. We must trigger React's internal state listeners
        // so it realizes text has been typed and enables the "Send" button.
        const inputEvent = new Event('input', { bubbles: true });
        textbox.dispatchEvent(inputEvent);

        // 5. Look for the Send button and click it
        const findAndClickSendButton = setInterval(() => {
            // ChatGPT's send button usually has a test-id or an aria-label like "Send prompt"
            const sendButton = document.querySelector('[data-testid="send-button"]') ||
                               document.querySelector('button[aria-label*="Send"]');

            if (sendButton && !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true') {
                clearInterval(findAndClickSendButton);
                setTimeout(() => {
                    sendButton.click();
                }, 150); // Tiny delay to let the React state update complete
            }
        }, 100);

        // Timeout checking for send button after 8 seconds in case of lag
        setTimeout(() => {
            clearInterval(findAndClickSendButton);
        }, 8000);
    }
})();
