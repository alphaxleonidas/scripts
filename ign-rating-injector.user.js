// ==UserScript==
// @name         Steam & Epic IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.5.4
// @description  Displays IGN review score, user ratings, and the matched IGN game title directly above the game image on Steam's right sidebar and on Epic Games Store.
// @author       Leonidas
// @match        https://*.steampowered.com/*
// @match        https://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.ign.com
// @connect      ign.com
// ==/UserScript==

(function () {
    'use strict';

    let isFetching = false;
    let lastProcessedTitle = '';
    let debounceTimer = null;

    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    // ---- Title aliases for unpredictable abbreviations or release year differentiation ----
    const TITLE_ALIASES = {
        'counter-strike 2': ['counter-strike: global offensive', 'counter-strike'],
        'cs2': ['counter-strike: global offensive'],
        'overwatch 2': ['overwatch'],
        'ea sports fc 24': ['fifa 24', 'fifa 23'],
        'eafc 24': ['fifa 24'],
        'final fantasy vii remake intergrade': ['final fantasy vii remake'],
        'jurassic world evolution 3: rebirth expansion': ['jurassic world evolution 3'],
        'conan exiles enhanced: isle of siptah': ['conan exiles'],
        'ratchet & clank: rift apart': ['ratchet and clank rift apart'],
        'brütal legend': ['brutal legend', 'brtal-legend'],
        'brutal legend': ['brtal-legend'],
        'guilty gear xrd rev 2': ['guilty gear xrd revelator 2'],
        'guilty gear': ['guilty-gear-1998'],
        'grand theft auto v': ['grand theft auto 5', 'gta v', 'gta 5']
    };

    // 1. Slug generator for IGN URLs
    function createIgnSlugs(title) {
        let noPeriods = title.replace(/\./g, '');

        let cleaned = noPeriods
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ä/g, 'a').replace(/Ä/g, 'a')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ß/g, 'ss')
            .replace(/Δ/g, 'delta')
            .replace(/Ω/g, 'omega');

        cleaned = cleaned
            .replace(/\b(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, '')
            .replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi, '')
            .trim();

        let slug = cleaned
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();

        const primarySlug = slug.replace(/&/g, 'and');
        const secondarySlug = slug.replace(/&/g, '');
        
        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0)
            ? noPrefix.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase().replace(/&/g, 'and')
            : null;

        let aggressiveDropSlug = noPeriods
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/[^a-z0-9]/gi, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase();

        return { 
            primarySlug, 
            secondarySlug, 
            tertiarySlug, 
            aggressiveDropSlug: (aggressiveDropSlug !== primarySlug) ? aggressiveDropSlug : null 
        };
    }

    // 2. Extracts title reliably across standard, mobile, and age-gate pages
    function getGameTitle() {
        if (IS_STEAM) {
            const titleEl = document.getElementById('appHubAppName') ||
                            document.querySelector('.page_title_area .apphub_AppName') ||
                            document.querySelector('.app_header_content .app_name');
            if (titleEl && titleEl.textContent.trim()) {
                return titleEl.textContent.trim();
            }

            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                let title = ogTitle.content.trim()
                    .replace(/^Save \d+% on /i, '')
                    .replace(/^Pre-purchase /i, '')
                    .replace(/ on Steam$/i, '')
                    .trim();
                if (title) return title;
            }

            if (document.title) {
                let title = document.title
                    .replace(/^Save \d+% on /i, '')
                    .replace(/^Pre-purchase /i, '')
                    .replace(/ on Steam$/i, '')
                    .trim();
                if (title && title !== 'Steam') return title;
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

    // 3. Targets placement (Upper right sidebar above game image for Steam)
    function getTargetInsertionPoint() {
        if (IS_STEAM) {
            const headerImage = document.querySelector('.game_header_image_full') ||
                                document.querySelector('.game_header_image_ctn') ||
                                document.querySelector('.glance_ctn_responsive .game_header_image_full');
            if (headerImage) {
                return { element: headerImage, position: 'before' };
            }

            const glanceCtn = document.querySelector('.glance_ctn_responsive') ||
                              document.querySelector('.game_meta_data');
            if (glanceCtn) {
                return { element: glanceCtn, position: 'prepend' };
            }

            const mobileReviews = document.querySelector('#user_reviews_container') ||
                                  document.querySelector('.user_reviews_filter_score') ||
                                  document.querySelector('.review_histogram_rollup');
            if (mobileReviews) {
                return { element: mobileReviews, position: 'after' };
            }
        }

        if (IS_EPIC) {
            const epicTarget = document.querySelector('[data-testid="purchase-cta-layout"]') ||
                               document.querySelector('aside') ||
                               document.querySelector('[role="main"]');
            if (epicTarget) return { element: epicTarget, position: 'prepend' };
        }

        return null;
    }

    // 4. Render Rating Badge
    function renderRatingBadge(ignScore, userScore, ignUrl, pageTitleStr, fetchedGameTitle = '') {
        const targetObj = getTargetInsertionPoint();
        if (!targetObj) return;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        // Use the exact title scraped from IGN's h1 tag if available, otherwise fall back to slug/page title cleanup
        let displayName = fetchedGameTitle;
        if (!displayName) {
            let slugPart = ignUrl.split('/games/')[1] || pageTitleStr;
            displayName = slugPart.replace(/-/g, ' ');
            displayName = displayName.replace(/\b\w/g, l => l.toUpperCase());
        }

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
            <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; max-width: 110px; overflow: hidden;">
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
                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(displayName)}" style="
                    font-size: 10px;
                    color: #b8b8b8;
                    text-decoration: none;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    width: 100%;
                    margin-top: 3px;
                ">
                    ${escapeHtml(displayName)} ↗
                </a>
            </div>
            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 32px;"></div>
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(ignScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; margin-top: 3px;">IGN Score</span>
            </div>
            <div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 32px;"></div>
            <div style="display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 16px; font-weight: bold; color: #ffffff; line-height: 1;">${escapeHtml(userScore)}</span>
                <span style="font-size: 9px; color: #8f98a0; text-transform: uppercase; font-weight: bold; margin-top: 3px;">User Rating</span>
            </div>
        `;

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

    // 5. Network Request with alias support
    function fetchIGNRatings(gameTitle) {
        isFetching = true;
        const slugsObj = createIgnSlugs(gameTitle);
        let slugs = [slugsObj.primarySlug, slugsObj.secondarySlug, slugsObj.tertiarySlug, slugsObj.aggressiveDropSlug].filter(Boolean);

        const lowerTitle = gameTitle.toLowerCase().trim();
        if (TITLE_ALIASES.hasOwnProperty(lowerTitle)) {
            const aliases = TITLE_ALIASES[lowerTitle];
            for (const alias of aliases) {
                if (!alias.includes(' ')) {
                    slugs.push(alias);
                }
                const aliasSlugs = createIgnSlugs(alias);
                const toAdd = [aliasSlugs.primarySlug, aliasSlugs.secondarySlug, aliasSlugs.tertiarySlug, aliasSlugs.aggressiveDropSlug].filter(Boolean);
                slugs = slugs.concat(toAdd);
            }
        }

        slugs = [...new Set(slugs)];
        const urlsToTry = slugs.map(slug => `https://www.ign.com/games/${slug}`);

        function requestPage(index = 0) {
            if (index >= urlsToTry.length) {
                renderRatingBadge('N/A', 'N/A', urlsToTry[0] || 'https://www.ign.com', gameTitle);
                isFetching = false;
                return;
            }

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
                        renderRatingBadge('N/A', 'N/A', targetUrl, gameTitle);
                        isFetching = false;
                        return;
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Extract the exact title from the IGN page's header element
                    let fetchedGameTitle = '';
                    const h1TitleEl = doc.querySelector('h1[data-cy="object-header-display-title"]') || doc.querySelector('h1.display-title');
                    if (h1TitleEl && h1TitleEl.textContent.trim()) {
                        fetchedGameTitle = h1TitleEl.textContent.trim();
                    }

                    let ignScore = 'N/A';
                    let userScore = 'N/A';

                    const jsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
                    jsonScripts.forEach(script => {
                        try {
                            const data = JSON.parse(script.textContent);
                            if (data.reviewRating?.ratingValue) {
                                ignScore = String(data.reviewRating.ratingValue);
                            }
                        } catch (e) {}
                    });

                    if (ignScore === 'N/A') {
                        const ignScoreWrapper = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
                        if (ignScoreWrapper) ignScore = ignScoreWrapper.textContent.trim();
                    }

                    const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
                    if (userReviewsLink) {
                        const ratingEl = userReviewsLink.querySelector('[data-cy="score-rating-small"]');
                        if (ratingEl) userScore = ratingEl.textContent.trim();
                    }

                    if (userScore === 'N/A') {
                        const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
                        if (smallScoreEls.length > 0) {
                            userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
                        }
                    }

                    renderRatingBadge(ignScore, userScore, targetUrl, gameTitle, fetchedGameTitle);
                    isFetching = false;
                },
                onerror: function () {
                    renderRatingBadge('Error', 'Error', targetUrl, gameTitle);
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

    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(init, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
