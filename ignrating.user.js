// ==UserScript==
// @name         Steam & Epic IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Displays IGN review score and user ratings on Steam and Epic Games Store pages with clickable header and smart fallback slug logic.
// @author       Leonidas
// @match        https://store.steampowered.com/app/*
// @match        https://store.epicgames.com/*
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

        // Primary slug with "and"
        const primarySlug = baseTitle
            .replace(/&/g, 'and')
            .replace(/\s+/g, '-')
            .toLowerCase();

        // Secondary fallback slug removing "&" completely
        const secondarySlug = baseTitle
            .replace(/&/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase();

        return { primarySlug, secondarySlug };
    }

    // 2. Extract Game Title based on current Store
    function getGameTitle() {
        if (IS_STEAM) {
            const titleEl = document.getElementById('appHubAppName');
            return titleEl ? titleEl.textContent.trim() : null;
        }

        if (IS_EPIC) {
            // Target Epic Games main title heading or metadata title
            const h1El = document.querySelector('h1') || document.querySelector('[data-testid="pdp-title"]');
            if (h1El) return h1El.textContent.trim();
        }

        return null;
    }

    // Helper to escape HTML characters
    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    // 3. Find injection point depending on store platform
    function getTargetContainer() {
        if (IS_STEAM) {
            return document.querySelector('.user_reviews') || document.querySelector('.glance_ctn');
        }

        if (IS_EPIC) {
            // Inject near Epic's sidebar metadata/pricing actions block
            return document.querySelector('[data-testid="purchase-cta-layout"]') ||
                   document.querySelector('aside') ||
                   document.querySelector('[role="main"]');
        }

        return null;
    }

    // 4. Render UI Badge
    function renderRatingBadge(ignScore, userScore, ignUrl) {
        const targetContainer = getTargetContainer();
        if (!targetContainer) return;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';

        // Custom styling adjustments per store theme
        badgeCtn.style.cssText = `
            margin-top: 12px;
            margin-bottom: 12px;
            padding: 10px 12px;
            background: ${IS_EPIC ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.35)'};
            border-radius: 4px;
            border-left: 4px solid #bf1313;
            font-family: ${IS_EPIC ? 'sans-serif' : '"Motiva Sans", sans-serif'};
            width: 100%;
            box-sizing: border-box;
        `;

        badgeCtn.innerHTML = `
            <!-- Clickable Header Link -->
            <div style="margin-bottom: 8px;">
                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="
                    font-weight: bold;
                    color: #ff3e3e;
                    font-size: 11px;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    transition: color 0.2s ease;
                " onmouseover="this.style.color='#ff6b6b'" onmouseout="this.style.color='#ff3e3e'">
                    IGN Ratings ↗
                </a>
            </div>

            <!-- Ratings Container -->
            <div style="display: flex; gap: 20px; align-items: center; justify-content: flex-start; padding-top: 2px;">
                <div style="text-align: center; min-width: 70px;">
                    <div style="font-size: 20px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(ignScore)}</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 4px; text-transform: uppercase;">IGN Score</div>
                </div>
                <div style="border-left: 1px solid #3d4450; height: 28px;"></div>
                <div style="text-align: center; min-width: 70px;">
                    <div style="font-size: 20px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(userScore)}</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 4px; text-transform: uppercase;">User Rating</div>
                </div>
            </div>
        `;

        if (IS_EPIC) {
            targetContainer.prepend(badgeCtn);
        } else {
            targetContainer.appendChild(badgeCtn);
        }
    }

    // 5. Fetch and Parse IGN Game Page with Automatic Fallback
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

                    // --- Extract IGN Editor Score ---
                    let ignScore = 'N/A';
                    const ignScoreWrapper = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
                    if (ignScoreWrapper) {
                        ignScore = ignScoreWrapper.textContent.trim();
                    }

                    // --- Extract User Rating ---
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

    // Dynamic Observer execution (vital for Epic Games Store client routing)
    function init() {
        const title = getGameTitle();
        if (title && !document.querySelector('.ign_rating_row')) {
            fetchIGNRatings(title);
        }
    }

    // Initial Trigger
    init();

    // Epic relies heavily on SPA dynamic client-side rendering
    const observer = new MutationObserver(() => {
        init();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
