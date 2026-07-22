// ==UserScript==
// @name         Steam & Epic IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Displays IGN review score and user ratings on Steam and Epic Games Store with unified layout styling (scores above labels).
// @author       Leonidas
// @match        *://*.steampowered.com/*
// @match        *://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.ign.com
// @connect      ign.com
// ==/UserScript==

(function () {
    'use strict';

    // Detect site environment
    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    // 1. Clean title and generate IGN URL slugs
    function createIgnSlugs(title) {
        const baseTitle = title
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\b(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|enhanced|remastered)\s*edition\b/gi, '')
            .replace(/\b(remastered|remake)\b/gi, '')
            .replace(/[^a-z0-9\s-&]/gi, '')
            .trim();

        const primarySlug = baseTitle
            .replace(/&/g, 'and')
            .replace(/\s+/g, '-')
            .toLowerCase();

        const secondarySlug = baseTitle
            .replace(/&/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase();

        return { primarySlug, secondarySlug };
    }

    // 2. Extract Game Title
    function getGameTitle() {
        if (IS_STEAM) {
            const titleEl = document.getElementById('appHubAppName') || 
                            document.querySelector('.page_title_area .apphub_AppName') || 
                            document.querySelector('.page_content .stats_count_desc');
            return titleEl ? titleEl.textContent.trim() : null;
        }

        if (IS_EPIC) {
            const h1El = document.querySelector('h1') || document.querySelector('[data-testid="pdp-title"]');
            if (h1El) return h1El.textContent.trim();
        }

        return null;
    }

    // Helper to escape HTML characters
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // 3. Find injection point
    function getTargetContainer() {
        if (IS_STEAM) {
            return document.querySelector('.user_reviews') || 
                   document.querySelector('.glance_ctn') || 
                   document.querySelector('.game_title_area') || 
                   document.querySelector('.app_header_content');
        }

        if (IS_EPIC) {
            return document.querySelector('[data-testid="purchase-cta-layout"]') ||
                   document.querySelector('aside') ||
                   document.querySelector('[role="main"]');
        }

        return null;
    }

    // 4. Render UI Badge (Numbers on top, Labels underneath)
    function renderRatingBadge(ignScore, userScore, ignUrl) {
        const targetContainer = getTargetContainer();
        if (!targetContainer) return;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';

        const isEpic = IS_EPIC;
        badgeCtn.style.cssText = `
            margin-top: 12px;
            margin-bottom: 12px;
            padding: ${isEpic ? '8px 10px' : '10px 14px'};
            background: ${isEpic ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.35)'};
            border-radius: 4px;
            border-left: 4px solid #bf1313;
            font-family: ${isEpic ? 'sans-serif' : '"Motiva Sans", sans-serif'};
            width: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: ${isEpic ? 'space-around' : 'flex-start'};
            gap: ${isEpic ? '8px' : '18px'};
        `;

        badgeCtn.innerHTML = `
            <!-- Column 1: IGN Header Link -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="
                    font-weight: bold;
                    color: #ff3e3e;
                    font-size: ${isEpic ? '11px' : '12px'};
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: color 0.2s ease;
                " onmouseover="this.style.color='#ff6b6b'" onmouseout="this.style.color='#ff3e3e'">
                    IGN Ratings ↗
                </a>
            </div>

            <!-- Vertical Separator -->
            <div style="border-left: 1px solid #3d4450; height: ${isEpic ? '26px' : '30px'};"></div>

            <!-- Column 2: IGN Score (Number top, Label bottom) -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: ${isEpic ? '16px' : '18px'}; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(ignScore)}</span>
                <span style="font-size: ${isEpic ? '9px' : '10px'}; color: #8f98a0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; margin-top: 3px;">IGN Score</span>
            </div>

            <!-- Vertical Separator -->
            <div style="border-left: 1px solid #3d4450; height: ${isEpic ? '26px' : '30px'};"></div>

            <!-- Column 3: User Rating (Number top, Label bottom) -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: ${isEpic ? '16px' : '18px'}; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(userScore)}</span>
                <span style="font-size: ${isEpic ? '9px' : '10px'}; color: #8f98a0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; margin-top: 3px;">User Rating</span>
            </div>
        `;

        if (IS_EPIC) {
            targetContainer.prepend(badgeCtn);
        } else {
            targetContainer.appendChild(badgeCtn);
        }
    }

    // 5. Fetch and Parse IGN Game Page
    function fetchIGNRatings(gameTitle) {
        const { primarySlug, secondarySlug } = createIgnSlugs(gameTitle);
        const primaryUrl = `https://www.ign.com/games/${primarySlug}`;
        const fallbackUrl = `https://www.ign.com/games/${secondarySlug}`;

        function requestPage(targetUrl, isRetry = false) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                onload: function (response) {
                    if (response.status === 404 && !isRetry && primarySlug !== secondarySlug) {
                        requestPage(fallbackUrl, true);
                        return;
                    }

                    if (response.status === 404) {
                        renderRatingBadge('N/A', 'N/A', targetUrl);
                        return;
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Extraction Logic
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
                },
                onerror: function () {
                    renderRatingBadge('Error', 'Error', targetUrl);
                }
            });
        }

        requestPage(primaryUrl);
    }

    // Dynamic Observer execution
    function init() {
        const title = getGameTitle();
        if (title && !document.querySelector('.ign_rating_row')) {
            fetchIGNRatings(title);
        }
    }

    init();

    const observer = new MutationObserver(() => {
        init();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
