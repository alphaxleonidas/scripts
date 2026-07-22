// ==UserScript==
// @name         Steam & Epic IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Displays IGN review score and user ratings on Steam (desktop & mobile) and Epic Games Store with unified layout styling and smart multi-slug fallback.
// @author       Leonidas
// @match        *://*.steampowered.com/*
// @match        *://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.ign.com
// @connect      ign.com
// ==/UserScript==

(function () {
    'use strict';

    // Track processing status to avoid duplicate network requests
    let isFetching = false;
    let lastProcessedTitle = '';

    // Detect site environment
    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    // 1. Clean title and generate IGN URL slugs (with acronym/prefix fallback)
    function createIgnSlugs(title) {
        const cleaned = title
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\b(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, '')
            .replace(/\b(remastered|remake)\b/gi, '')
            .replace(/[^a-z0-9\s-&]/gi, '')
            .trim();

        const makeSlug = (str) => str.replace(/\s+/g, '-').toLowerCase();

        // Standard Primary & Secondary Slugs
        const primarySlug = makeSlug(cleaned.replace(/&/g, 'and'));
        const secondarySlug = makeSlug(cleaned.replace(/&/g, ''));

        // Tertiary Slug: Strips leading short acronyms/prefixes
        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0) 
            ? makeSlug(noPrefix.replace(/&/g, 'and')) 
            : null;

        return { primarySlug, secondarySlug, tertiarySlug };
    }

    // 2. Extract Game Title (Includes Steam Mobile meta fallback)
    function getGameTitle() {
        if (IS_STEAM) {
            // Standard Steam Selectors
            let titleEl = document.getElementById('appHubAppName') || 
                          document.querySelector('.page_title_area .apphub_AppName') || 
                          document.querySelector('.page_content .stats_count_desc') ||
                          document.querySelector('.app_header_content .app_name') ||
                          document.querySelector('.mobile_app_name') ||
                          document.querySelector('h2.page_title');

            if (titleEl && titleEl.textContent.trim()) {
                return titleEl.textContent.trim();
            }

            // Mobile OpenGraph Fallback (Very reliable on Steam Mobile)
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                let rawTitle = ogTitle.content.trim();
                // Strip Steam title suffix/prefixes
                rawTitle = rawTitle.replace(/^Save \d+% on /i, '').replace(/ on Steam$/i, '');
                return rawTitle;
            }

            // Document Title Fallback
            if (document.title.includes('on Steam')) {
                const titleMatch = document.title.match(/Save \d+% on (.*?) on Steam/i) || document.title.match(/(.*?) on Steam/i);
                if (titleMatch && titleMatch[1]) {
                    return titleMatch[1].trim();
                }
            }
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

    // 3. Find injection point (Includes Steam Mobile support)
    function getTargetContainer() {
        if (IS_STEAM) {
            return document.querySelector('.user_reviews') || 
                   document.querySelector('.glance_ctn') || 
                   document.querySelector('#game_highlights') ||
                   document.querySelector('.game_title_area') || 
                   document.querySelector('.game_header_area') ||
                   document.querySelector('.app_header_content') ||
                   document.querySelector('.game_area_purchase_margin') ||
                   document.querySelector('.app_content') ||
                   document.querySelector('.responsive_page_template_simple');
        }

        if (IS_EPIC) {
            return document.querySelector('[data-testid="purchase-cta-layout"]') ||
                   document.querySelector('aside') ||
                   document.querySelector('[role="main"]');
        }

        return null;
    }

    // 4. Render UI Badge (Styled to resemble Epic's clean layout across Mobile & Desktop)
    function renderRatingBadge(ignScore, userScore, ignUrl) {
        const targetContainer = getTargetContainer();
        if (!targetContainer) return;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';

        const isMobile = window.innerWidth <= 768;
        const useEpicStyle = IS_EPIC || isMobile;

        badgeCtn.style.cssText = `
            margin-top: 10px;
            margin-bottom: 10px;
            padding: ${useEpicStyle ? '8px 10px' : '10px 14px'};
            background: ${useEpicStyle ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.35)'};
            border-radius: 4px;
            border-left: 4px solid #bf1313;
            font-family: ${IS_EPIC ? 'sans-serif' : '"Motiva Sans", -apple-system, BlinkMacSystemFont, sans-serif'};
            width: 100%;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: space-around;
            gap: 6px;
        `;

        badgeCtn.innerHTML = `
            <!-- Column 1: IGN Header Link -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center;">
                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="
                    font-weight: bold;
                    color: #ff3e3e;
                    font-size: ${useEpicStyle ? '11px' : '12px'};
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: color 0.2s ease;
                " onmouseover="this.style.color='#ff6b6b'" onmouseout="this.style.color='#ff3e3e'">
                    IGN Ratings ↗
                </a>
            </div>

            <!-- Vertical Separator -->
            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 24px;"></div>

            <!-- Column 2: IGN Score -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: ${useEpicStyle ? '15px' : '18px'}; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(ignScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; margin-top: 3px;">IGN Score</span>
            </div>

            <!-- Vertical Separator -->
            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 24px;"></div>

            <!-- Column 3: User Rating -->
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: ${useEpicStyle ? '15px' : '18px'}; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(userScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; margin-top: 3px;">User Rating</span>
            </div>
        `;

        if (IS_EPIC || isMobile) {
            targetContainer.prepend(badgeCtn);
        } else {
            targetContainer.appendChild(badgeCtn);
        }
    }

    // 5. Fetch and Parse IGN Game Page with Array-based Fallback Pipeline
    function fetchIGNRatings(gameTitle) {
        isFetching = true;
        const { primarySlug, secondarySlug, tertiarySlug } = createIgnSlugs(gameTitle);

        // Build array of unique candidate URLs
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
                    // If 404, try the next URL candidate in the array
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

    // Dynamic Observer execution
    function init() {
        const title = getGameTitle();
        if (!title) return;

        // Reset tracking if title changed on SPA navigation
        if (title !== lastProcessedTitle) {
            lastProcessedTitle = title;
            const existingBadge = document.querySelector('.ign_rating_row');
            if (existingBadge) existingBadge.remove();
        }

        if (!document.querySelector('.ign_rating_row') && !isFetching) {
            fetchIGNRatings(title);
        }
    }

    init();

    const observer = new MutationObserver(() => {
        init();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
