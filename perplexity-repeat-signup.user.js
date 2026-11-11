// ==UserScript==
// @name         Perplexity Repeat Sign-Up Request
// @namespace    local
// @version      2.0.0
// @description  Automatically repeats the previous request when Perplexity returns a sign-up message.
// @match        https://www.perplexity.ai/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const REPEAT_MESSAGES = new Set([
    "Sign up and repeat your request.",
    "Regístrate y repite tu solicitud.",
    "Inscrivez-vous et répétez votre demande.",
    "Melde dich an und wiederhole deine Anfrage.",
    "Iscriviti e ripeti la tua richiesta.",
    "Registre-se e repita o seu pedido.",
    "Registre-se e repita sua solicitação.",
    "Регистрирайте се и повторете заявката си.",
    "Registruj se i ponovi svoj zahtjev.",
    "Zaregistrujte se a opakujte svou žádost.",
    "Tilmeld dig og gentag din anmodning.",
    "Registreeru ja korda oma taotlust.",
    "Rekisteröidy ja toista pyyntösi.",
    "Γραφτείτε και επαναλάβετε το αίτημά σας.",
    "Regisztráljon, és ismételje meg kérését.",
    "Skráðu þig og endurtaktu beiðnina.",
    "Registrati e ripeti la tua richiesta.",
    "Reģistrējieties un atkārtojiet savu pieprasījumu.",
    "Registruokitės ir pakartokite savo prašymą.",
    "Regjistrohu dhe përsërit kërkesën tënde.",
    "Registruj se i ponovi svoj zahtev.",
    "Zarejestruj się i powtórz swoją prośbę.",
    "Зарегистрируйтесь и повторите свой запрос.",
    "Registrujte sa a opakujte svoju žiadosť.",
    "Registrirajte se in ponovite svojo zahtevo.",
    "Registrera dig och upprepa din begäran.",
    "Регистрируйтесь и повторите свой запрос.",
    "Реєструйтеся та повторіть свій запит.",
    "Kaydolun ve isteğinizi tekrarlayın.",
    "Забележете се и повторете вашето запитване.",
    "التسجيل وتكرار طلبك.",
    "سائن اپ کریں اور اپنی درخواست دہرائیں۔",
    "সাইন আপ করুন এবং আপনার অনুরোধ পুনরাবৃত্তি করুন।",
    "Zaregistrujte se a zopakujte svou žádost.",
    "Mag-sign up at ulitin ang iyong kahilingan.",
    "Rexístrate e repite a túa solicitude.",
    "הירשם וחזור על בקשתך.",
    "पंजीकरण करें और अपना अनुरोध दोहराएं।",
    "Đað skrá sig og endurtaka beiðnina.",
    "Daftar dan ulangi permintaan Anda.",
    "サインアップしてリクエストを繰り返してください。",
    "សូមចុះឈ្មោះនិងធ្វើម្តងទៀតនូវសំណើរបស់អ្នក។",
    "가입하고 요청을 반복하세요.",
    "ລົງທະບຽນແລະຄືນຄຳຮ້ອງຂໍຂອງທ່ານ.",
    "Registracija ir pakartokite savo prašymą.",
    "Регистрирајте се и повторете го вашето барање.",
    "Daftar dan ulangi permintaan anda.",
    "സൈൻ അപ്പ് ചെയ്യുക, നിങ്ങളുടെ അഭ്യർത്ഥന ആവർത്തിക്കുക.",
    "नोंदणी करा आणि तुमची विनंती पुन्हा करा.",
    "Дараад бүртгүүлээд хүсэлтээ давтана уу.",
    "साइन अप गर्नुहोस् र आफ्नो अनुरोध दोहोर्याउनुहोस्।",
    "Registrér deg og gjenta forespørselen din.",
    "ثبت‌نام کنید و درخواست خود را تکرار کنید.",
    "ਸਾਈਨ ਅੱਪ ਕਰੋ ਅਤੇ ਆਪਣੀ ਬੇਨਤੀ ਦੁਹਰਾਓ।",
    "Înregistrează-te și repetă cererea ta.",
    "Региструјте се и поновите свој захтев.",
    "ලියාපදිංචි වී ඔබේ ඉල්ලීම නැවත කරන්න.",
    "Jiisaji na urudia ombi lako.",
    "பதிவு செய்து உங்கள் கோரிக்கையை மீண்டும் செய்யவும்.",
    "సైన్ అప్ చేసి, మీ అభ్యర్థనను పునరావృతం చేయండి.",
    "สมัครสมาชิกและทำซ้ำคำขอของคุณ",
    "Зареєструйтеся та повторіть свій запит.",
    "Đăng ký và lặp lại yêu cầu của bạn.",
    "注册并重复您的请求。",
    "註冊並重複您的請求。"
  ]);

  const INPUT_SELECTOR =
    '[data-composer="true"] [contenteditable="true"][data-lexical-editor="true"]';

  const SUBMIT_SELECTOR =
    '[data-composer="true"] button[aria-label="Submit"]';

  const FINAL_RESPONSE_SELECTOR =
    '[data-workflow-final-text] div[data-renderer="lm"]';

  const USER_MESSAGE_SELECTOR =
    'div[data-renderer="lm"] p';

  let handledResponse = null;
  let isSubmitting = false;
  let lastSubmittedRequest = "";
  let checkTimer = null;
  let responseWaitTimer = null;

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

  function getPreviousUserMessage() {
    const messages = [
      ...document.querySelectorAll(USER_MESSAGE_SELECTOR)
    ]
      .filter(paragraph => {
        return !paragraph.closest("[data-workflow-final-text]");
      })
      .map(paragraph => cleanText(paragraph.innerText))
      .filter(Boolean);

    return messages.at(-1) || "";
  }

  /*
   * Replace the editor contents.
   *
   * Perplexity's Lexical editor writes to the DOM asynchronously, so the
   * text is NOT visible right after execCommand() returns. The result is
   * therefore polled, and other insertion methods are tried only if the
   * text never appears.
   */
  async function setEditorText(editor, text) {
    if (!editor || !editor.isConnected) {
      return false;
    }

    const expectedText = cleanText(text);

    const hasExpectedText = () =>
      editor.isConnected && cleanText(editor.innerText) === expectedText;

    function selectEditorContents() {
      editor.focus();

      const selection = window.getSelection();
      const range = document.createRange();

      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function moveCaretToEnd() {
      const selection = window.getSelection();
      const endRange = document.createRange();

      endRange.selectNodeContents(editor);
      endRange.collapse(false);

      selection.removeAllRanges();
      selection.addRange(endRange);
    }

    const methods = [
      [
        "execCommand insertText",
        () => document.execCommand("insertText", false, text)
      ],
      [
        "synthetic paste",
        () => {
          const data = new DataTransfer();
          data.setData("text/plain", text);

          return editor.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: data,
              bubbles: true,
              cancelable: true
            })
          );
        }
      ],
      [
        "synthetic beforeinput",
        () =>
          editor.dispatchEvent(
            new InputEvent("beforeinput", {
              inputType: "insertText",
              data: text,
              bubbles: true,
              cancelable: true
            })
          )
      ]
    ];

    for (const [name, insert] of methods) {
      selectEditorContents();

      try {
        insert();
      } catch (error) {
        console.warn(
          `[Perplexity Repeat] Insert method "${name}" threw:`,
          error
        );
        continue;
      }

      // Give Lexical time to flush its update to the DOM.
      if (await waitUntil(hasExpectedText, 1500, 50)) {
        moveCaretToEnd();
        console.log(`[Perplexity Repeat] Inserted text via: ${name}`);
        return true;
      }

      console.warn(
        `[Perplexity Repeat] Insert method "${name}" did not populate the editor.`
      );
    }

    console.error(
      "[Perplexity Repeat] Editor insertion failed. " +
        JSON.stringify({
          expected: expectedText,
          actual: cleanText(editor.innerText),
          hasLexicalInstance: !!editor.__lexicalEditor,
          activeElement: document.activeElement
            ? document.activeElement.tagName
            : null,
          activeIsInsideEditor: editor.contains(document.activeElement)
        })
    );

    return false;
  }

  /*
   * Wait until the Submit button is enabled.
   */
  function waitForSubmitButton(timeout = 10000) {
    return new Promise(resolve => {
      const start = Date.now();

      function check() {
        const button = document.querySelector(SUBMIT_SELECTOR);

        if (
          button &&
          !button.disabled &&
          button.getAttribute("aria-disabled") !== "true"
        ) {
          resolve(button);
          return;
        }

        if (Date.now() - start >= timeout) {
          resolve(null);
          return;
        }

        setTimeout(check, 200);
      }

      check();
    });
  }

  /*
   * Monitor for a new response.
   */
  function waitForNewResponse(oldResponse) {
    if (responseWaitTimer) {
      clearInterval(responseWaitTimer);
    }

    let attempts = 0;

    responseWaitTimer = setInterval(() => {
      attempts++;

      const currentResponse = getLatestFinalResponse();

      if (
        currentResponse &&
        currentResponse !== oldResponse
      ) {
        clearInterval(responseWaitTimer);
        responseWaitTimer = null;
        isSubmitting = false;
        scheduleCheck();
        return;
      }

      if (attempts >= 120) {
        clearInterval(responseWaitTimer);
        responseWaitTimer = null;

        console.warn(
          "[Perplexity Repeat] Timed out waiting for response."
        );

        isSubmitting = false;
      }
    }, 500);
  }

  /*
   * ---- Submit helpers -------------------------------------------------
   * A single synthetic .click() is not reliable on Perplexity (the Lexical
   * composer submits on Enter, and an open sign-in modal can interfere with
   * button clicks). So several strategies are tried in order, and after each
   * one we verify that the message was really sent before trying the next.
   */

  const USER_BUBBLE_SELECTOR = '[data-message-bubble="right"]';

  const BUILD = "insert-wait-4";

  /*
   * Network spy: records method + path (never bodies) of fetch() calls so we
   * can tell "Perplexity fired a request" apart from "Perplexity ignored us".
   */
  const ASK_PATH_RE = /perplexity_ask|\/sse\/|\/ask(\/|$)/i;
  const recentRequests = [];

  function recordRequest(method, url) {
    try {
      const path = new URL(String(url), location.href).pathname;
      recentRequests.push({ t: Date.now(), method: String(method || "GET").toUpperCase(), path });
      if (recentRequests.length > 40) {
        recentRequests.shift();
      }
    } catch (_) {
      /* ignore unparsable URLs */
    }
  }

  function installNetworkSpy() {
    try {
      const original = window.fetch;

      if (typeof original !== "function" || original.__pplxRepeatSpy) {
        return;
      }

      const spy = function (input, init) {
        try {
          const method =
            (init && init.method) || (input && input.method) || "GET";
          const url = typeof input === "string" ? input : (input && input.url) || input;
          recordRequest(method, url);
        } catch (_) {
          /* never let the spy break the page */
        }
        return original.apply(window, arguments);
      };

      spy.__pplxRepeatSpy = true;
      window.fetch = spy;
    } catch (_) {
      /* spy is optional */
    }
  }

  function askRequestSince(since) {
    return recentRequests.some(
      r => r.t >= since && r.method === "POST" && ASK_PATH_RE.test(r.path)
    );
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function countUserBubbles() {
    return document.querySelectorAll(USER_BUBBLE_SELECTOR).length;
  }

  function isEnabled(button) {
    return (
      !!button &&
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true"
    );
  }

  /*
   * True once the message has left the composer: either a new user bubble
   * appeared, or the editor no longer contains the request text.
   */
  function wasSent(bubblesBefore, request, since) {
    if (countUserBubbles() > bubblesBefore) {
      return true;
    }

    if (since !== undefined && askRequestSince(since)) {
      return true;
    }

    const editor = document.querySelector(INPUT_SELECTOR);

    if (!editor) {
      return false;
    }

    return cleanText(editor.innerText) !== cleanText(request);
  }

  async function waitUntil(predicate, timeout = 2500, interval = 100) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (predicate()) {
        return true;
      }
      await sleep(interval);
    }

    return predicate();
  }

  /*
   * Strategy 1: dispatch Enter on the editor (what a human does).
   */
  function submitWithEnter() {
    const editor = document.querySelector(INPUT_SELECTOR);

    if (!editor) {
      return false;
    }

    try {
      editor.focus({ preventScroll: true });
    } catch (_) {
      /* focus may be blocked by the modal's focus trap; not required */
    }

    const init = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    };

    for (const type of ["keydown", "keypress", "keyup"]) {
      const event = new KeyboardEvent(type, init);

      // Some engines ignore keyCode/which in the init dict; force them.
      Object.defineProperty(event, "keyCode", { get: () => 13 });
      Object.defineProperty(event, "which", { get: () => 13 });

      editor.dispatchEvent(event);
    }

    return true;
  }

  /*
   * Strategy 2: plain button.click().
   */
  function submitWithClick() {
    const button = document.querySelector(SUBMIT_SELECTOR);

    if (!isEnabled(button)) {
      return false;
    }

    button.click();
    return true;
  }

  /*
   * Strategy 3: call the button's React onClick prop directly. This skips
   * every DOM-level filter (pointer-events, overlays, isTrusted checks).
   */
  function getReactProps(element) {
    const key = Object.keys(element).find(k => k.startsWith("__reactProps$"));
    return key ? element[key] : null;
  }

  function submitWithReactOnClick() {
    const button = document.querySelector(SUBMIT_SELECTOR);

    if (!isEnabled(button)) {
      return false;
    }

    const props = getReactProps(button);

    if (!props || typeof props.onClick !== "function") {
      return false;
    }

    const nativeEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0
    });

    props.onClick({
      type: "click",
      target: button,
      currentTarget: button,
      nativeEvent,
      button: 0,
      defaultPrevented: false,
      preventDefault() {},
      stopPropagation() {},
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      persist() {}
    });

    return true;
  }

  /*
   * Strategy 4: full pointer/mouse sequence on the button, for handlers
   * bound to pointerdown/mousedown instead of click.
   * Last resort. (The sign-in gate is non-dismissible, so this cannot close it.)
   */
  function submitWithPointerSequence() {
    const button = document.querySelector(SUBMIT_SELECTOR);

    if (!isEnabled(button)) {
      return false;
    }

    const rect = button.getBoundingClientRect();

    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    const pointer = {
      ...base,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };

    button.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, buttons: 1 }));
    button.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    button.dispatchEvent(new PointerEvent("pointerup", { ...pointer, buttons: 0 }));
    button.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    button.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));

    return true;
  }

  function logSubmitDiagnostics(request, since) {
    const editor = document.querySelector(INPUT_SELECTOR);
    const button = document.querySelector(SUBMIT_SELECTOR);
    const root = document.getElementById("root");
    const active = document.activeElement;

    const info = {
      build: BUILD,
      request,
      editorFound: !!editor,
      editorText: editor ? cleanText(editor.innerText) : null,
      editorHasLexicalInstance: !!(editor && editor.__lexicalEditor),
      buttonFound: !!button,
      buttonDisabled: button ? button.disabled : null,
      buttonAriaLabel: button ? button.getAttribute("aria-label") : null,
      buttonHasReactOnClick: !!(button && getReactProps(button) && typeof getReactProps(button).onClick === "function"),
      dialogsOpen: document.querySelectorAll('[role="dialog"]').length,
      dialogLabel: (document.querySelector('[role="dialog"]') || {}).ariaLabel || null,
      rootAriaHidden: root ? root.getAttribute("aria-hidden") : null,
      bodyPointerEvents: document.body ? document.body.style.pointerEvents : null,
      activeElement: active
        ? active.tagName + (active.getAttribute("role") ? `[role=${active.getAttribute("role")}]` : "")
        : null,
      activeIsInsideEditor: !!(editor && active && editor.contains(active)),
      userBubbles: countUserBubbles(),
      requestsSinceAttempt: recentRequests
        .filter(r => r.t >= since)
        .map(r => `${r.method} ${r.path}`)
    };

    console.error(
      "[Perplexity Repeat] All submit strategies failed. DIAGNOSTICS " +
        JSON.stringify(info)
    );
  }

  async function submitWithFallbacks(request) {
    const bubblesBefore = countUserBubbles();
    const since = Date.now();

    const strategies = [
      ["Enter key", submitWithEnter],
      ["button click", submitWithClick],
      ["React onClick", submitWithReactOnClick],
      ["pointer sequence", submitWithPointerSequence]
    ];

    for (const [name, run] of strategies) {
      // Never fire another strategy if a previous one already worked.
      if (wasSent(bubblesBefore, request, since)) {
        return true;
      }

      console.log(`[Perplexity Repeat] Trying submit strategy: ${name}`);

      if (!run()) {
        console.warn(
          `[Perplexity Repeat] Strategy "${name}" could not run.`
        );
        continue;
      }

      const sent = await waitUntil(
        () => wasSent(bubblesBefore, request, since)
      );

      if (sent) {
        console.log(`[Perplexity Repeat] Sent via: ${name}`);
        return true;
      }

      console.warn(
        `[Perplexity Repeat] Strategy "${name}" had no effect.`
      );
    }

    submitWithFallbacks.lastSince = since;
    return wasSent(bubblesBefore, request, since);
  }

  /*
   * Populate editor and click the actual Submit button.
   */
  async function submitRequest(request) {
    if (isSubmitting || !request) {
      return;
    }

    if (request === lastSubmittedRequest) {
      console.warn(
        "[Perplexity Repeat] Request already submitted."
      );
      return;
    }

    const editor = document.querySelector(INPUT_SELECTOR);

    if (!editor) {
      console.warn(
        "[Perplexity Repeat] Lexical editor not found."
      );
      return;
    }

    isSubmitting = true;
    const oldResponse = handledResponse;

    console.log(
      "[Perplexity Repeat] Preparing request:",
      request
    );

    const success = await setEditorText(editor, request);

    if (!success) {
      isSubmitting = false;
      return;
    }

    // Let Perplexity's state catch up with the editor change.
    await new Promise(resolve => setTimeout(resolve, 700));

    const submitButton = await waitForSubmitButton();

    if (!submitButton) {
      console.warn(
        "[Perplexity Repeat] Submit button did not become enabled."
      );
      isSubmitting = false;
      return;
    }

    // Verify editor contents one final time.
    if (
      !editor.isConnected ||
      cleanText(editor.innerText) !== cleanText(request)
    ) {
      console.error(
        "[Perplexity Repeat] Editor contents changed unexpectedly."
      );
      isSubmitting = false;
      return;
    }

    // Record before submitting to prevent duplicates.
    lastSubmittedRequest = request;

    const sent = await submitWithFallbacks(request);

    if (!sent) {
      logSubmitDiagnostics(request, submitWithFallbacks.lastSince || 0);
      lastSubmittedRequest = "";
      isSubmitting = false;
      return;
    }

    waitForNewResponse(oldResponse);
  }

  /*
   * Detect multilingual sign-up response.
   */
  function repeatIfRequired() {
    if (isSubmitting) {
      return;
    }

    const latestResponse = getLatestFinalResponse();

    if (!latestResponse || latestResponse === handledResponse) {
      return;
    }

    const responseText = cleanText(latestResponse.innerText);

    if (!REPEAT_MESSAGES.has(responseText)) {
      return;
    }

    handledResponse = latestResponse;

    const previousRequest = getPreviousUserMessage();

    if (!previousRequest) {
      console.warn(
        "[Perplexity Repeat] Previous user request not found."
      );
      return;
    }

    if (previousRequest === lastSubmittedRequest) {
      console.warn(
        "[Perplexity Repeat] Same request already submitted."
      );
      return;
    }

    console.log(
      "[Perplexity Repeat] Trigger detected:",
      responseText
    );

    submitRequest(previousRequest);
  }

  /*
   * Debounce DOM changes.
   */
  function scheduleCheck() {
    if (checkTimer) {
      clearTimeout(checkTimer);
    }

    checkTimer = setTimeout(() => {
      checkTimer = null;
      repeatIfRequired();
    }, 200);
  }

  /*
   * Observe Perplexity's interface.
   */
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

    installNetworkSpy();

    console.log(
      `[Perplexity Repeat] Script initialized. Build: ${BUILD}`
    );

    scheduleCheck();
  }

  start();
})();
