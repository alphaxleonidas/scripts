// ==UserScript==
// @name         Steam IGN Rating Display
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Displays IGN review score and user ratings on Steam game pages with clickable header.
// @author       Leonidas
// @match        https://store.steampowered.com/app/*
// @grant        GM_xmlhttpRequest
// @connect      www.ign.com
// @connect      ign.com
// ==/UserScript==

(function () {
    'use strict';

    // 1. Clean title and generate clean IGN URL slug
    function createIgnSlug(title) {
        let cleanTitle = title
            // Remove common Steam edition suffixes
            .replace(/\b(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|enhanced|remastered)\s*edition\b/gi, '')
            .replace(/\b(remastered|remake)\b/gi, '')
            .replace(/™|®|©/g, '')
            .replace(/[^a-z0-9\s-]/gi, '')
            .trim();

        return cleanTitle
            .toLowerCase()
            .replace(/\s+/g, '-');
    }

    // 2. Extract Title from Steam Page
    function getSteamGameTitle() {
        const titleEl = document.getElementById('appHubAppName');
        return titleEl ? titleEl.textContent.trim() : null;
    }

    // 3. Render UI Badge (Header is now the clickable link)
    function renderRatingBadge(ignScore, userScore, ignUrl) {
        const targetContainer = document.querySelector('.user_reviews') || document.querySelector('.glance_ctn');
        if (!targetContainer) return;

        // Prevent duplicate badges
        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'user_reviews_summary_row ign_rating_row';
        badgeCtn.style.cssText = `
            margin-top: 10px;
            padding: 10px 12px;
            background: rgba(0, 0, 0, 0.35);
            border-radius: 4px;
            border-left: 4px solid #bf1313;
            font-family: "Motiva Sans", sans-serif;
        `;

        badgeCtn.innerHTML = `
            <!-- Clickable Header Link -->
            <div style="margin-bottom: 8px;">
                <a href="${ignUrl}" target="_blank" rel="noopener noreferrer" style="
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
                    <div style="font-size: 20px; font-weight: bold; color: #ffffff; line-height: 1;">${ignScore}</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 4px; text-transform: uppercase;">IGN Score</div>
                </div>
                <div style="border-left: 1px solid #3d4450; height: 28px;"></div>
                <div style="text-align: center; min-width: 70px;">
                    <div style="font-size: 20px; font-weight: bold; color: #ffffff; line-height: 1;">${userScore}</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 4px; text-transform: uppercase;">User Rating</div>
                </div>
            </div>
        `;

        targetContainer.appendChild(badgeCtn);
    }

    // 4. Fetch and Parse IGN Game Page
    function fetchIGNRatings(gameTitle) {
        const slug = createIgnSlug(gameTitle);
        const ignUrl = `https://www.ign.com/games/${slug}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: ignUrl,
            onload: function (response) {
                if (response.status === 404) {
                    renderRatingBadge('N/A', 'N/A', ignUrl);
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

                // Primary check: targeting user-reviews anchor block with score-rating-small
                const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
                if (userReviewsLink) {
                    const ratingEl = userReviewsLink.querySelector('[data-cy="score-rating-small"]');
                    if (ratingEl) {
                        userScore = ratingEl.textContent.trim();
                    }
                }

                // Fallback check: target score-rating-small globally if link structure varies
                if (userScore === 'N/A') {
                    const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
                    if (smallScoreEls.length > 0) {
                        userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
                    }
                }

                // Fallback check: JSON-LD metadata for editor review
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

                renderRatingBadge(ignScore, userScore, ignUrl);
            },
            onerror: function () {
                renderRatingBadge('Error', 'Error', ignUrl);
            }
        });
    }

    // Run script
    const title = getSteamGameTitle();
    if (title) {
        fetchIGNRatings(title);
    }
})();
