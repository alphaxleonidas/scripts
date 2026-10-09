// ==UserScript==
// @name         ChatGPT URL Search Injector & Auto-Submit
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Allows searching ChatGPT directly via URL: https://chatgpt.com/?q=your+query
// @author       Leonidas
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Browser search engine URL:
// https://chatgpt.com/?q=%s

(function () {
    'use strict';

    const STORAGE_KEY = 'chatgpt-url-search-prompt';
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q') || params.get('prompt');

    // Step 1: Save the query and redirect away from ChatGPT's native ?q= flow.
    if (query) {
        try {
            sessionStorage.setItem(STORAGE_KEY, query);
        } catch (error) {
            console.warn('[ChatGPT URL Search] Could not save prompt:', error);
        }

        const cleanUrl =
            window.location.origin +
            window.location.pathname +
            window.location.hash;

        if (window.location.search !== '') {
            window.location.replace(cleanUrl);
        }

        return;
    }

    // Step 2: After the clean redirect, retrieve and insert the saved prompt.
    const savedQuery = sessionStorage.getItem(STORAGE_KEY);

    if (!savedQuery) return;

    // Remove it immediately so refreshing does not insert it again.
    sessionStorage.removeItem(STORAGE_KEY);

    let attempts = 0;
    let injected = false;

    const composerPoll = setInterval(() => {
        attempts++;

        if (attempts > 300) {
            clearInterval(composerPoll);
            console.warn('[ChatGPT URL Search] Composer did not appear.');
            return;
        }

        const composer =
            document.querySelector('#mobile-composer-prompt') ||
            document.querySelector('textarea[name="prompt"]') ||
            document.querySelector('#prompt-textarea') ||
            document.querySelector('div[contenteditable="true"]');

        if (!composer || injected) return;

        injected = true;
        clearInterval(composerPoll);

        // Let ChatGPT finish initializing its composer/editor bindings.
        setTimeout(() => {
            insertPrompt(composer, savedQuery);
        }, 300);
    }, 100);

    // Stop polling after 30 seconds.
    setTimeout(() => {
        clearInterval(composerPoll);
    }, 30000);

    function insertPrompt(composer, text) {
        composer.focus();

        if (composer.tagName === 'TEXTAREA') {
            insertIntoTextarea(composer, text);
        } else {
            insertIntoEditable(composer, text);
        }

        // Give ChatGPT time to register the inserted draft before Enter.
        setTimeout(() => {
            pressEnter(composer);
        }, 700);
    }

    function insertIntoTextarea(textarea, text) {
        textarea.value = '';

        textarea.dispatchEvent(new Event('input', {
            bubbles: true,
            composed: true
        }));

        textarea.focus();

        const inserted = document.execCommand('insertText', false, text);

        // Fallback if execCommand is unavailable or blocked.
        if (!inserted || textarea.value !== text) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value'
            ).set;

            nativeSetter.call(textarea, text);

            textarea.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                inputType: 'insertText',
                data: text
            }));
        }
    }

    function insertIntoEditable(editor, text) {
        editor.textContent = '';

        editor.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            composed: true,
            inputType: 'insertText',
            data: text
        }));

        document.execCommand('insertText', false, text);

        editor.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            composed: true,
            inputType: 'insertText',
            data: text
        }));
    }

    function pressEnter(composer) {
        const enterOptions = {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
        };

        // Send the normal Enter key sequence.
        composer.dispatchEvent(new KeyboardEvent('keydown', enterOptions));
        composer.dispatchEvent(new KeyboardEvent('keypress', enterOptions));
        composer.dispatchEvent(new KeyboardEvent('keyup', enterOptions));

        console.log('[ChatGPT URL Search] Enter sent.');
    }
})();
