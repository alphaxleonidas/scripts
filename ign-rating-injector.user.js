// ==UserScript==
// @name         Steam & Epic IGN Rating & Extra Info Display
// @namespace    http://tampermonkey.net/
// @version      1.9.2
// @description  Displays IGN review scores, user ratings, clickable HLTB times with Leisure time.
// @author       Leonidas
// @match        https://*.steampowered.com/*
// @match        https://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      www.ign.com
// @connect      ign.com
// @connect      howlongtobeat.com
// ==/UserScript==

(function () {
    'use strict';

    let isFetching = false;
    let lastProcessedTitle = '';
    let debounceTimer = null;

    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    // ---- Settings (Tampermonkey menu toggles) ----
    const CONFIG_KEYS = {
        showIgnScore: 'Show IGN Score',
        showUserRating: 'Show User Rating',
        showHltb: 'Show HowLongToBeat',
        showLeisure: 'Show HLTB Leisure Times',
        showDeveloper: 'Show Developer',
        showEsrb: 'Show ESRB Rating & Descriptors',
        showAward: 'Show IGN Award / Leaderboard'
    };

    const CONFIG_DEFAULTS = {
        showIgnScore: true,
        showUserRating: true,
        showHltb: true,
        showLeisure: true,
        showDeveloper: true,
        showEsrb: true,
        showAward: true
    };

    const getConfig = (key) => GM_getValue(key, CONFIG_DEFAULTS[key]);

    function toggleConfig(key) {
        const newVal = !getConfig(key);
        GM_setValue(key, newVal);
        alert(`IGN Script: "${CONFIG_KEYS[key]}" set to ${newVal ? 'Enabled' : 'Disabled'}. Refresh page to apply.`);
    }

    if (typeof GM_registerMenuCommand !== 'undefined') {
        for (const [key, label] of Object.entries(CONFIG_KEYS)) {
            GM_registerMenuCommand(`Toggle: ${label}`, () => toggleConfig(key));
        }
    }

    // ---- Title aliases: abbreviations / release-year variants IGN uses different slugs for ----
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

    // ---- 1. Slug generation ----
    function slugify(str) {
        return str.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }

    function createIgnSlugs(title) {
        const noPeriods = title.replace(/\./g, '');

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

        const slug = slugify(cleaned);
        const primarySlug = slug.replace(/&/g, 'and');
        const secondarySlug = slug.replace(/&/g, '');

        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0)
            ? slugify(noPrefix).replace(/&/g, 'and')
            : null;

        const aggressiveDropSlug = slugify(noPeriods.replace(/[^\x00-\x7F]/g, ''));

        return {
            primarySlug,
            secondarySlug,
            tertiarySlug,
            aggressiveDropSlug: (aggressiveDropSlug !== primarySlug) ? aggressiveDropSlug : null
        };
    }

    function slugsToList(slugsObj) {
        return [slugsObj.primarySlug, slugsObj.secondarySlug, slugsObj.tertiarySlug, slugsObj.aggressiveDropSlug].filter(Boolean);
    }

    // ---- 2. Title extraction (handles standard, mobile, and age-gate pages) ----
    function cleanSteamTitle(raw) {
        return raw.replace(/^Save \d+% on /i, '').replace(/^Pre-purchase /i, '').replace(/ on Steam$/i, '').trim();
    }

    function getGameTitle() {
        if (IS_STEAM) {
            const titleEl = document.getElementById('appHubAppName') ||
                document.querySelector('.page_title_area .apphub_AppName') ||
                document.querySelector('.app_header_content .app_name');
            if (titleEl && titleEl.textContent.trim()) return titleEl.textContent.trim();

            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                const title = cleanSteamTitle(ogTitle.content.trim());
                if (title) return title;
            }

            if (document.title) {
                const title = cleanSteamTitle(document.title);
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

    // ---- 3. Insertion point ----
    function getTargetInsertionPoint() {
        if (IS_STEAM) {
            const headerImage = document.querySelector('.game_header_image_full') ||
                document.querySelector('.game_header_image_ctn') ||
                document.querySelector('.glance_ctn_responsive .game_header_image_full');
            if (headerImage) return { element: headerImage, position: 'before' };

            const glanceCtn = document.querySelector('.glance_ctn_responsive') || document.querySelector('.game_meta_data');
            if (glanceCtn) return { element: glanceCtn, position: 'prepend' };

            const mobileReviews = document.querySelector('#user_reviews_container') ||
                document.querySelector('.user_reviews_filter_score') ||
                document.querySelector('.review_histogram_rollup');
            if (mobileReviews) return { element: mobileReviews, position: 'after' };
        }

        if (IS_EPIC) {
            const epicTarget = document.querySelector('[data-testid="purchase-cta-layout"]') ||
                document.querySelector('aside') ||
                document.querySelector('[role="main"]');
            if (epicTarget) return { element: epicTarget, position: 'prepend' };
        }

        return null;
    }

    // ---- 4. Badge rendering ----
    const BADGE_STYLE = `
        margin: 10px auto; padding: 14px 16px;
        background: linear-gradient(135deg, rgba(20,20,20,0.95), rgba(35,35,35,0.95));
        border-radius: 8px; border-left: 5px solid #ff3e3e;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 100%; box-sizing: border-box;
        display: flex; flex-direction: column; gap: 12px; clear: both; color: #ffffff;
    `;

    // Small stat block used by both the score row and the HLTB row
    function statBlock(value, label, valueSize = '18px', valueColor = '#ffffff', labelSize = '8px') {
        return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;">
                <span style="font-size:${valueSize};font-weight:bold;color:${valueColor};line-height:1.1;">${escapeHtml(value)}</span>
                <span style="font-size:${labelSize};color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-top:3px;white-space:nowrap;">${escapeHtml(label)}</span>
            </div>`;
    }

    const divider = (height = '32px') => `<div style="border-left:1px solid rgba(255,255,255,0.15);height:${height};"></div>`;
    const sectionRow = (extra = '') => `border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;${extra}`;

    function buildTopRow(ignScore, userScore, ignUrl, displayName) {
        const showIgn = getConfig('showIgnScore');
        const showUser = getConfig('showUserRating');
        if (!showIgn && !showUser) return '';

        let scoresHtml = '';
        if (showIgn) scoresHtml += statBlock(ignScore, 'IGN Score', '22px', '#ffffff', '11px');
        if (showIgn && showUser) scoresHtml += divider();
        if (showUser) scoresHtml += statBlock(userScore, 'User Rating', '22px', '#ffffff', '11px');

        return `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                <div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;max-width:130px;overflow:hidden;">
                    <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:bold;color:#ff3e3e;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;white-space:nowrap;">IGN Overview ↗</a>
                    <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(displayName)}" style="font-size:10px;color:#b8b8b8;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-top:2px;">${escapeHtml(displayName)} ↗</a>
                </div>
                <div style="display:flex;align-items:center;gap:14px;">${scoresHtml}</div>
            </div>`;
    }

    function buildAwardRow(awardData) {
        if (!getConfig('showAward') || !awardData) return '';
        return `
            <a href="https://www.ign.com/icons" target="_blank" rel="noopener noreferrer" style="${sectionRow('display:flex;align-items:center;justify-content:space-between;font-size:11px;text-decoration:none;')}">
                <span style="color:#a1b0bd;font-weight:bold;">Leaderboard Rank:</span>
                <span style="color:#f1c40f;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">#${escapeHtml(awardData.rank)} (${escapeHtml(awardData.label)}) ↗</span>
            </a>`;
    }

    function buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors) {
        if (!getConfig('showEsrb') || !(esrbImgSrc || esrbDescriptors)) return '';
        const img = esrbImgSrc
            ? `<img src="${esrbImgSrc}" alt="${escapeHtml(esrbAlt)}" title="${escapeHtml(esrbAlt)}" style="height:56px;border-radius:4px;flex-shrink:0;box-shadow:0 2px 5px rgba(0,0,0,0.3);" />`
            : '';
        const desc = esrbDescriptors
            ? `<span style="color:#d0d0d0;font-size:10px;line-height:1.3;margin-top:2px;"><strong>Description:</strong> ${escapeHtml(esrbDescriptors)}</span>`
            : '';
        return `
            <div style="${sectionRow('display:flex;align-items:flex-start;gap:12px;')}">
                ${img}
                <div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2px;flex:1;">
                    <span style="color:#ffffff;font-size:13px;font-weight:bold;line-height:1.2;">${escapeHtml(esrbAlt)}</span>
                    ${desc}
                </div>
            </div>`;
    }

    function buildDevRow(developerName) {
        if (!getConfig('showDeveloper') || !developerName) return '';
        return `
            <div style="${sectionRow('display:flex;align-items:center;justify-content:space-between;font-size:11px;')}">
                <span style="color:#a1b0bd;font-weight:bold;">Developer:</span>
                <span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${escapeHtml(developerName)}">${escapeHtml(developerName)}</span>
            </div>`;
    }

    // Display-only label renames for HLTB categories
    const HLTB_LABEL_OVERRIDES = {
        'main story': 'Main',
        'story + sides': 'Main + Sides'
    };

    function relabelHltb(label) {
        return HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()] || label;
    }

    function buildHltbRow(hltbData, hltbUrl) {
        if (!getConfig('showHltb') || !(hltbData && hltbData.length > 0)) return '';

        // Display-only: drop the "All Styles" entry and apply label renames
        const displayData = hltbData.filter(item => !/all styles/i.test(item.label));
        if (displayData.length === 0) return '';

        const items = displayData.map(item => statBlock(item.time, relabelHltb(item.label), '16px', '#66c0f4', '10px')).join(divider('26px'));
        return `
            <a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer"
               style="${sectionRow('display:flex;flex-direction:column;gap:8px;text-decoration:none;background:rgba(102,192,244,0.03);padding:8px;border-radius:6px;transition:background 0.2s;')}"
               onmouseover="this.style.background='rgba(102,192,244,0.08)'" onmouseout="this.style.background='rgba(102,192,244,0.03)'">
                <span style="font-size:10px;color:#66c0f4;text-transform:uppercase;font-weight:bold;">HowLongToBeat ↗</span>
                <div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div>
            </a>`;
    }

    // Standalone "Leisure" time section, sourced from the HLTB game page itself (not IGN).
    // Built and injected independently after the main badge renders, so a failed/missing
    // fetch here never affects the rest of the overlay.
    function buildLeisureRow(leisureData, hltbUrl) {
        if (!getConfig('showLeisure') || !leisureData || leisureData.length === 0) return '';

        const items = leisureData.map(item => statBlock(item.time, relabelHltb(item.label), '16px', '#9b59b6', '10px')).join(divider('26px'));
        return `
            <a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer"
               style="${sectionRow('display:flex;flex-direction:column;gap:8px;text-decoration:none;background:rgba(155,89,182,0.03);padding:8px;border-radius:6px;transition:background 0.2s;')}"
               onmouseover="this.style.background='rgba(155,89,182,0.08)'" onmouseout="this.style.background='rgba(155,89,182,0.03)'">
                <span style="font-size:10px;color:#9b59b6;text-transform:uppercase;font-weight:bold;">HLTB Leisure Time ↗</span>
                <div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div>
            </a>`;
    }

    // Shared fallback: if we couldn't scrape a direct HLTB URL, fall back to an HLTB search link
    function resolveHltbUrl(hltbUrl, displayName) {
        return hltbUrl || `https://howlongtobeat.com/?q=${encodeURIComponent(displayName)}`;
    }

    function renderCompleteBadge(ignScore, userScore, hltbData, hltbUrl, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, ignUrl, fetchedGameTitle = '') {
        const targetObj = getTargetInsertionPoint();
        if (!targetObj) return null;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        let displayName = fetchedGameTitle;
        if (!displayName) {
            const slugPart = ignUrl.split('/games/')[1] || '';
            displayName = slugPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        const resolvedHltbUrl = resolveHltbUrl(hltbUrl, displayName);

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';
        badgeCtn.style.cssText = BADGE_STYLE;

        badgeCtn.innerHTML =
            buildTopRow(ignScore, userScore, ignUrl, displayName) +
            buildAwardRow(awardData) +
            buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors) +
            buildDevRow(developerName) +
            buildHltbRow(hltbData, resolvedHltbUrl);

        if (!badgeCtn.innerHTML.trim()) return null;

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

        return resolvedHltbUrl;
    }

    // ---- 5. Fetching & page parsing ----
    function buildCandidateSlugs(gameTitle) {
        let slugs = slugsToList(createIgnSlugs(gameTitle));

        const lowerTitle = gameTitle.toLowerCase().trim();
        if (TITLE_ALIASES.hasOwnProperty(lowerTitle)) {
            for (const alias of TITLE_ALIASES[lowerTitle]) {
                if (!alias.includes(' ')) slugs.push(alias);
                slugs = slugs.concat(slugsToList(createIgnSlugs(alias)));
            }
        }

        return [...new Set(slugs)];
    }

    function parseIgnPage(doc) {
        let fetchedGameTitle = '';
        const h1TitleEl = doc.querySelector('h1[data-cy="object-header-display-title"]') || doc.querySelector('h1.display-title');
        if (h1TitleEl && h1TitleEl.textContent.trim()) fetchedGameTitle = h1TitleEl.textContent.trim();

        // IGN score (prefer JSON-LD, fall back to the hexagon widget)
        let ignScore = 'N/A';
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                if (data.reviewRating?.ratingValue) ignScore = String(data.reviewRating.ratingValue);
            } catch (e) {}
        });
        if (ignScore === 'N/A') {
            const el = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
            if (el) ignScore = el.textContent.trim();
        }

        // User score
        let userScore = 'N/A';
        const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
        if (userReviewsLink) {
            const ratingEl = userReviewsLink.querySelector('[data-cy="score-rating-small"]');
            if (ratingEl) userScore = ratingEl.textContent.trim();
        }
        if (userScore === 'N/A') {
            const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
            if (smallScoreEls.length > 0) userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
        }

        // Developer / producer
        let developerName = '';
        const devEl = doc.querySelector('[data-cy="developerLink"]') ||
            doc.querySelector('a[href*="/games/developer/"]') ||
            doc.querySelector('[data-cy="producerLink"]') ||
            doc.querySelector('a[href*="/games/producer/"]');
        if (devEl && devEl.textContent.trim()) developerName = devEl.textContent.trim();

        // ESRB rating + descriptors
        let esrbImgSrc = '', esrbAlt = '', esrbDescriptors = '';
        const esrbImgEl = doc.querySelector('img[data-cy^="icon-esrb"]') || doc.querySelector('img[alt*="ESRB:"]');
        if (esrbImgEl) {
            esrbImgSrc = esrbImgEl.getAttribute('src');
            esrbAlt = esrbImgEl.getAttribute('alt') || 'ESRB Rating';
        }
        if (esrbAlt && esrbAlt.includes(':')) {
            const [ratingPart, ...rest] = esrbAlt.split(':');
            esrbAlt = ratingPart.trim();
            esrbDescriptors = rest.join(':').trim();
        }
        if (!esrbDescriptors) {
            const descContainer = doc.querySelector('[data-cy*="esrb-descriptors"]') || doc.querySelector('.esrb-descriptors');
            if (descContainer) esrbDescriptors = descContainer.textContent.trim();
        }

        // Leaderboard award
        let awardData = null;
        const awardEl = doc.querySelector('figure[data-cy="review-score"].icon-award') || doc.querySelector('[class*="icon-award"]');
        if (awardEl) {
            const rankText = awardEl.querySelector('figcaption')?.textContent.trim() || '';
            let labelType = 'Global Rank';
            if (awardEl.className.includes('icon-award-gold')) labelType = 'Gold Rank';
            else if (awardEl.className.includes('icon-award-silver')) labelType = 'Silver Rank';
            else if (awardEl.className.includes('icon-award-bronze')) labelType = 'Bronze Rank';
            if (rankText) awardData = { rank: rankText, label: labelType };
        }

        // HowLongToBeat
        const hltbData = [];
        let hltbUrl = '';
        const hltbContent = doc.querySelector('[data-cy="hl2b-content"]') || doc.querySelector('.hl2b-content');
        if (hltbContent) {
            hltbContent.querySelectorAll('.meta-item, [data-cy$="meta-item"]').forEach(item => {
                const timeEl = item.querySelector('.title4, [data-cy="title4"]');
                const captionEl = item.querySelector('.caption, [data-cy="caption"]');
                if (timeEl && captionEl) hltbData.push({ time: timeEl.textContent.trim(), label: captionEl.textContent.trim() });
            });

            const hltbLinkEl = hltbContent.closest('a[href*="howlongtobeat.com"]') || hltbContent.querySelector('a[href*="howlongtobeat.com"]');
            if (hltbLinkEl) hltbUrl = hltbLinkEl.getAttribute('href');
        }
        if (!hltbUrl) {
            const anyHltbLink = doc.querySelector('a[href*="howlongtobeat.com"]');
            if (anyHltbLink) hltbUrl = anyHltbLink.getAttribute('href');
        }

        return { fetchedGameTitle, ignScore, userScore, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, hltbData, hltbUrl };
    }

    function renderEmpty(status, targetUrl, gameTitle) {
        renderCompleteBadge(status, status, [], '', '', '', '', '', null, targetUrl, gameTitle);
    }

    // Games whose own IGN page has missing/unreliable HLTB data — pull it from another IGN page instead
    const HLTB_SOURCE_OVERRIDES = {
        'final fantasy vii remake intergrade': 'https://www.ign.com/games/final-fantasy-vii-remake'
    };

    // Fetches just the HLTB block from an override URL. Calls back with { hltbData, hltbUrl }.
    function fetchHltbOverride(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback({ hltbData: [], hltbUrl: '' }); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    const p = parseIgnPage(doc);
                    callback({ hltbData: p.hltbData, hltbUrl: p.hltbUrl });
                } catch (e) {
                    callback({ hltbData: [], hltbUrl: '' });
                }
            },
            onerror: function () { callback({ hltbData: [], hltbUrl: '' }); }
        });
    }

    // Parses the HLTB game page's own play-time table (Polled/Average/Median/Rushed/Leisure)
    // and pulls out the Leisure column, skipping "All PlayStyles".
    function parseHltbLeisureData(doc) {
        const table = doc.querySelector('table[class*="GameTimeTable"]');
        if (!table) return [];

        const headerCells = Array.from(table.querySelectorAll('thead td, thead th')).map(td => td.textContent.trim().toLowerCase());
        const leisureIndex = headerCells.indexOf('leisure');
        if (leisureIndex === -1) return [];

        const results = [];
        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length <= leisureIndex) return;

            const label = cells[0].textContent.trim();
            if (!label || /all\s*playstyles/i.test(label)) return;

            const leisureTime = cells[leisureIndex].textContent.trim();
            if (leisureTime) results.push({ label, time: leisureTime });
        });

        return results;
    }

    // Fetches the HLTB game page and extracts its Leisure-time data. Never throws — callback
    // always receives an array (possibly empty) so a failure here can't break the rest of the overlay.
    function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) { callback([]); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: hltbUrl,
            onload: function (response) {
                if (response.status !== 200) { callback([]); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    callback(parseHltbLeisureData(doc));
                } catch (e) {
                    callback([]);
                }
            },
            onerror: function () { callback([]); }
        });
    }

    function fetchIGNData(gameTitle) {
        isFetching = true;
        const urlsToTry = buildCandidateSlugs(gameTitle).map(slug => `https://www.ign.com/games/${slug}`);

        function requestPage(index = 0) {
            if (index >= urlsToTry.length) {
                renderEmpty('N/A', urlsToTry[0] || 'https://www.ign.com', gameTitle);
                isFetching = false;
                return;
            }

            const targetUrl = urlsToTry[index];

            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                onload: function (response) {
                    if (response.status === 404) {
                        if (index + 1 < urlsToTry.length) { requestPage(index + 1); return; }
                        renderEmpty('N/A', targetUrl, gameTitle);
                        isFetching = false;
                        return;
                    }

                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    const p = parseIgnPage(doc);

                    const finishRender = (hltbData, hltbUrl) => {
                        const resolvedHltbUrl = renderCompleteBadge(p.ignScore, p.userScore, hltbData, hltbUrl, p.developerName,
                            p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors, p.awardData, targetUrl, p.fetchedGameTitle);
                        isFetching = false;

                        // Leisure section is fetched from HLTB separately and injected after the
                        // fact, so it never delays or breaks the rest of the overlay.
                        if (resolvedHltbUrl && getConfig('showLeisure')) {
                            fetchHltbLeisure(resolvedHltbUrl, (leisureData) => {
                                const badge = document.querySelector('.ign_rating_row');
                                if (!badge) return;
                                const leisureHtml = buildLeisureRow(leisureData, resolvedHltbUrl);
                                if (leisureHtml) badge.insertAdjacentHTML('beforeend', leisureHtml);
                            });
                        }
                    };

                    const overrideUrl = HLTB_SOURCE_OVERRIDES[gameTitle.toLowerCase().trim()];
                    if (overrideUrl) {
                        fetchHltbOverride(overrideUrl, (r) => finishRender(r.hltbData, r.hltbUrl));
                    } else {
                        finishRender(p.hltbData, p.hltbUrl);
                    }
                },
                onerror: function () {
                    renderEmpty('Error', targetUrl, gameTitle);
                    isFetching = false;
                }
            });
        }

        requestPage(0);
    }

    // ---- 6. Bootstrapping ----
    function init() {
        const title = getGameTitle();
        if (!title) return;

        if (title !== lastProcessedTitle) {
            lastProcessedTitle = title;
            document.querySelector('.ign_rating_row')?.remove();
        }

        if (!document.querySelector('.ign_rating_row') && !isFetching) {
            fetchIGNData(title);
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
