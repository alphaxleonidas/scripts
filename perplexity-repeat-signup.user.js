// ==UserScript==
// @name         Perplexity Repeat Sign-Up Request
// @namespace    local
// @version      1.6
// @description  Repeats the previous request when the latest final response is a sign-up message.
// @match        https://www.perplexity.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const REPEAT_MESSAGES = new Set([
    "Sign up and repeat your request.",
    "Registra't i repeteix la teva sol·licitud."
  ]);

  const FINAL_RESPONSE_SELECTOR =
    '[data-workflow-final-text] div[data-renderer="lm"]';

  const USER_MESSAGE_SELECTOR =
    'div[data-renderer="lm"] p';

  const INPUT_SELECTOR = "#ask-input";
  const SUBMIT_SELECTOR = 'button[aria-label="Submit"]';

  let handledResponse = null;
  let isSubmitting = false;
  let lastSubmittedRequest = "";
  let checkTimer = null;

  function cleanText(text) {
    return (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getLatestFinalResponse() {
    const responses = [
      ...document.querySelectorAll(FINAL_RESPONSE_SELECTOR)
    ];

    return responses.at(-1) || null;
  }

  function getLatestFinalResponseText() {
    const response = getLatestFinalResponse();
    return response ? cleanText(response.innerText) : "";
  }

  function getPreviousUserMessage() {
    const messages = [
      ...document.querySelectorAll(USER_MESSAGE_SELECTOR)
    ]
      .filter((paragraph) => {
        return !paragraph.closest("[data-workflow-final-text]");
      })
      .map((paragraph) => cleanText(paragraph.innerText))
      .filter(Boolean);

    return messages.at(-1) || "";
  }

  /*
   * Completely replace the editor contents.
   *
   * We intentionally DO NOT use execCommand("insertText") here.
   * That was capable of causing the request to appear twice.
   */
  function setEditorText(editor, text) {
    editor.focus();

    /*
     * Select everything inside the editor.
     */
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(editor);

    selection.removeAllRanges();
    selection.addRange(range);

    /*
     * Delete the existing content first.
     */
    document.execCommand("delete", false);

    /*
     * Insert the request exactly once.
     */
    const textNode = document.createTextNode(text);
    editor.appendChild(textNode);

    /*
     * Put the caret at the end.
     */
    range.selectNodeContents(editor);
    range.collapse(false);

    selection.removeAllRanges();
    selection.addRange(range);

    /*
     * Tell Perplexity's React editor that the content changed.
     */
    editor.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );

    editor.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );
  }

  function submitRequest(request) {
    if (isSubmitting) {
      return;
    }

    const editor = document.querySelector(INPUT_SELECTOR);

    if (!editor) {
      console.warn(
        "[Perplexity Repeat] #ask-input was not found."
      );
      return;
    }

    /*
     * Final protection against submitting the same request twice.
     */
    if (request === lastSubmittedRequest) {
      console.warn(
        "[Perplexity Repeat] Request already submitted."
      );
      return;
    }

    isSubmitting = true;
    lastSubmittedRequest = request;

    console.log(
      "[Perplexity Repeat] Repeating:",
      request
    );

    setEditorText(editor, request);

    /*
     * Wait for Perplexity to process the editor change.
     */
    setTimeout(() => {
      const submitButton =
        document.querySelector(SUBMIT_SELECTOR);

      if (!submitButton) {
        console.warn(
          '[Perplexity Repeat] Submit button not found.'
        );

        isSubmitting = false;
        return;
      }

      if (
        submitButton.disabled ||
        submitButton.getAttribute("aria-disabled") === "true"
      ) {
        console.warn(
          "[Perplexity Repeat] Submit button is disabled."
        );

        isSubmitting = false;
        return;
      }

      submitButton.click();

      console.log(
        "[Perplexity Repeat] Submitted once."
      );

      waitForNewResponse();
    }, 700);
  }

  function waitForNewResponse() {
    const oldResponse = handledResponse;

    let attempts = 0;
    const maxAttempts = 120;

    const timer = setInterval(() => {
      attempts++;

      const currentResponse =
        getLatestFinalResponse();

      /*
       * Don't unlock until Perplexity creates a NEW response.
       */
      if (
        currentResponse &&
        currentResponse !== oldResponse
      ) {
        clearInterval(timer);

        isSubmitting = false;

        scheduleCheck();
        return;
      }

      /*
       * Safety timeout after 60 seconds.
       */
      if (attempts >= maxAttempts) {
        clearInterval(timer);

        console.warn(
          "[Perplexity Repeat] Timed out waiting for new response."
        );

        isSubmitting = false;
      }
    }, 500);
  }

  function repeatIfRequired() {
    if (isSubmitting) {
      return;
    }

    const latestResponse =
      getLatestFinalResponse();

    if (!latestResponse) {
      return;
    }

    /*
     * The SAME response element can generate many mutations.
     * Only process it once.
     */
    if (latestResponse === handledResponse) {
      return;
    }

    const responseText =
      cleanText(latestResponse.innerText);

    /*
     * Must exactly match one of the two trigger messages.
     */
    if (!REPEAT_MESSAGES.has(responseText)) {
      return;
    }

    /*
     * Mark it as handled BEFORE submitting.
     */
    handledResponse = latestResponse;

    const previousRequest =
      getPreviousUserMessage();

    if (!previousRequest) {
      console.warn(
        "[Perplexity Repeat] Previous user request not found."
      );
      return;
    }

    /*
     * Never submit the same request twice.
     */
    if (previousRequest === lastSubmittedRequest) {
      console.warn(
        "[Perplexity Repeat] Same request already submitted."
      );
      return;
    }

    console.log(
      "[Perplexity Repeat] Trigger:",
      responseText
    );

    submitRequest(previousRequest);
  }

  function scheduleCheck() {
    if (checkTimer) {
      clearTimeout(checkTimer);
    }

    checkTimer = setTimeout(() => {
      checkTimer = null;
      repeatIfRequired();
    }, 200);
  }

  const observer = new MutationObserver(() => {
    scheduleCheck();
  });

  function start() {
    if (!document.body) {
      setTimeout(start, 250);
      return;
    }

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    scheduleCheck();
  }

  start();
})();
