// ==UserScript==
// @name         Steam & Epic IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.3.1
// @description  Displays IGN review score and user ratings directly below User Reviews on Steam, and prepended in the purchase container on Epic Games Store.
// @author       Leonidas
// @match        *://*.steampowered.com/*
// @match        *://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.ign.com
// @connect      ign.com
// ==/UserScript==

(function () {
    'use strict';

    let isFetching = false;
    let lastProcessedTitle = '';

    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    // 1. Slug generator for IGN URLs
    function createIgnSlugs(title) {
        const cleaned = title
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\b(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, '')
            .replace(/\b(remastered|remake)\b/gi, '')
            .replace(/[^a-z0-9\s-&]/gi, '')
            .trim();

        const makeSlug = (str) => str.replace(/\s+/g, '-').toLowerCase();

        const primarySlug = makeSlug(cleaned.replace(/&/g, 'and'));
        const secondarySlug = makeSlug(cleaned.replace(/&/g, ''));
        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0)
            ? makeSlug(noPrefix.replace(/&/g, 'and'))
            : null;

        return { primarySlug, secondarySlug, tertiarySlug };
    }

    // 2. Extracts title reliably across standard, mobile, and age-gate pages
    function getGameTitle() {
        if (IS_STEAM) {
            // OpenGraph / Page Title
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                let title = ogTitle.content.trim()
                    .replace(/^Save \d+% on /i, '')
                    .replace(/ on Steam$/i, '')
                    .trim();
                if (title) return title;
            }

            if (document.title) {
                let title = document.title
                    .replace(/^Save \d+% on /i, '')
                    .replace(/ on Steam$/i, '')
                    .trim();
                if (title && title !== 'Steam') return title;
            }

            // DOM App Names
            let titleEl = document.getElementById('appHubAppName') ||
                          document.querySelector('.page_title_area .apphub_AppName') ||
                          document.querySelector('.app_header_content .app_name');

            if (titleEl && titleEl.textContent.trim()) {
                return titleEl.textContent.trim();
            }
        }

        if (IS_EPIC) {
            const h1El = document.querySelector('h1') || document.querySelector('[data-testid="pdp-title"]');
            if (h1El) return h1El.textContent.trim();
        }

        return null;
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // 3. Targets placement (v1.3.0 logic for Steam; v1.0.0 prepend logic for Epic)
    function getTargetInsertionPoint() {
        if (IS_STEAM) {
            // Priority 1: Steam Mobile & Desktop Review Containers
            const mobileReviews = document.querySelector('#user_reviews_container') ||
                                  document.querySelector('.user_reviews') ||
                                  document.querySelector('#app_reviews_hash') ||
                                  document.querySelector('.user_reviews_filter_score') ||
                                  document.querySelector('.review_histogram_rollup');

            if (mobileReviews) {
                return { element: mobileReviews, position: 'after' };
            }

            // Priority 2: Steam Mobile Page Content Container
            const gameDetailsCol = document.querySelector('.game_details_and_reviews_column') ||
                                   document.querySelector('#game_highlights') ||
                                   document.querySelector('.app_content_ctn');

            if (gameDetailsCol) {
                return { element: gameDetailsCol, position: 'append' };
            }

            // Priority 3: Steam Age-Gate Fallback
            const ageGateCtn = document.querySelector('.agegate_birthday_selector') ||
                               document.querySelector('.agegate_text_container');

            if (ageGateCtn) {
                return { element: ageGateCtn, position: 'before' };
            }
        }

        if (IS_EPIC) {
            // Reverted to v1.0.0 targets with 'prepend' position for both mobile & desktop
            const epicTarget = document.querySelector('[data-testid="purchase-cta-layout"]') ||
                               document.querySelector('aside') ||
                               document.querySelector('[role="main"]');
            if (epicTarget) return { element: epicTarget, position: 'prepend' };
        }

        return null;
    }

    // 4. Render Rating Badge
    function renderRatingBadge(ignScore, userScore, ignUrl) {
        const targetObj = getTargetInsertionPoint();
        if (!targetObj) return;

        // Prevent duplicate rendering
        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';

        badgeCtn.style.cssText = `
            margin: 10px auto;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 6px;
            border-left: 4px solid #bf1313;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-around;
            gap: 8px;
            clear: both;
        `;

        badgeCtn.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="
                    font-weight: bold;
                    color: #ff3e3e;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    text-decoration: none;
                    white-space: nowrap;
                ">
                    IGN Ratings ↗
                </a>
            </div>

            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 26px;"></div>

            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(ignScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; margin-top: 3px;">IGN Score</span>
            </div>

            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 26px;"></div>

            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(userScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; margin-top: 3px;">User Rating</span>
            </div>
        `;

        // Insertion Logic
        const { element, position } = targetObj;
        if (position === 'after' && element.parentNode) {
            element.parentNode.insertBefore(badgeCtn, element.nextSibling);
        } else if (position === 'before' && element.parentNode) {
            element.parentNode.insertBefore(badgeCtn, element);
        } else if (position === 'prepend') {
            element.prepend(badgeCtn);
        } else {
            element.appendChild(badgeCtn);
        }
    }

    // 5. Network Request to Fetch IGN Ratings
    function fetchIGNRatings(gameTitle) {
        isFetching = true;
        const { primarySlug, secondarySlug, tertiarySlug } = createIgnSlugs(gameTitle);

        const urlsToTry = [...new Set([
            `https://www.ign.com/games/${primarySlug}`,
            `https://www.ign.com/games/${secondarySlug}`,
            tertiarySlug ? `https://www.ign.com/games/${tertiarySlug}` : null
        ].filter(Boolean))];

        function requestPage(index = 0) {
            const targetUrl = urlsToTry[index];

            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                onload: function (response) {
                    if (response.status === 404 && index + 1 < urlsToTry.length) {
                        requestPage(index + 1);
                        return;
                    }

                    if (response.status === 404) {
                        renderRatingBadge('N/A', 'N/A', targetUrl);
                        isFetching = false;
                        return;
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    let ignScore = 'N/A';
                    const ignScoreWrapper = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
                    if (ignScoreWrapper) {
                        ignScore = ignScoreWrapper.textContent.trim();
                    }

                    let userScore = 'N/A';
                    const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
                    if (userReviewsLink) {
                        const ratingEl = userReviewsLink.querySelector('[data-cy="score-rating-small"]');
                        if (ratingEl) {
                            userScore = ratingEl.textContent.trim();
                        }
                    }

                    if (userScore === 'N/A') {
                        const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
                        if (smallScoreEls.length > 0) {
                            userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
                        }
                    }

                    if (ignScore === 'N/A') {
                        const jsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
                        jsonScripts.forEach(script => {
                            try {
                                const data = JSON.parse(script.textContent);
                                if (data.reviewRating?.ratingValue) {
                                    ignScore = data.reviewRating.ratingValue;
                                }
                            } catch (e) {}
                        });
                    }

                    renderRatingBadge(ignScore, userScore, targetUrl);
                    isFetching = false;
                },
                onerror: function () {
                    renderRatingBadge('Error', 'Error', targetUrl);
                    isFetching = false;
                }
            });
        }

        requestPage(0);
    }

    function init() {
        const title = getGameTitle();
        if (!title) return;

        if (title !== lastProcessedTitle) {
            lastProcessedTitle = title;
            const existingBadge = document.querySelector('.ign_rating_row');
            if (existingBadge) existingBadge.remove();
        }

        if (!document.querySelector('.ign_rating_row') && !isFetching) {
            fetchIGNRatings(title);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Observer guarantees placement as user scrolls and mobile components load dynamically
    const observer = new MutationObserver(() => {
        init();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
