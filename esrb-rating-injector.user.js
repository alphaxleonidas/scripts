// ==UserScript==
// @name         Steam & Epic Games ESRB Rating Injector
// @namespace    https://github.com/
// @version      1.0.3
// @description  Injects high-res ESRB ratings, icons, descriptions, and links into Steam and Epic Games Store with strict title validation.
// @author       Leonidas
// @match        *://*.steampowered.com/*
// @match        *://*.epicgames.com/*
// @grant        GM_xmlhttpRequest
// @connect      esrb.org
// @connect      www.esrb.org
// ==/UserScript==

(function() {
    'use strict';

    let isFetching = false;
    let lastProcessedTitle = '';
    let debounceTimer = null;

    const IS_STEAM = window.location.hostname.includes('steampowered.com');
    const IS_EPIC = window.location.hostname.includes('epicgames.com');

    const TITLE_ALIASES = {
        'counter-strike 2': ['counter-strike: global offensive', 'counter-strike'],
        'cs2': ['counter-strike: global offensive'],
        'overwatch 2': ['overwatch'],
        'ea sports fc 24': ['fifa 24', 'fifa 23'],
        'eafc 24': ['fifa 24'],
        'jurassic world evolution 3': ['jurassic world evolution 3: rebirth expansion'],
        'conan exiles': ['conan exiles enhanced: isle of siptah']
    };

    const ESRB_ICONS = {
        'everyone': 'https://www.esrb.org/wp-content/uploads/2019/05/E.svg',
        'everyone 10+': 'https://www.esrb.org/wp-content/uploads/2019/05/E10plus.svg',
        'teen': 'https://www.esrb.org/wp-content/uploads/2019/05/T.svg',
        'mature 17+': 'https://www.esrb.org/wp-content/uploads/2019/05/M.svg',
        'mature': 'https://www.esrb.org/wp-content/uploads/2019/05/M.svg',
        'adults only 18+': 'https://www.esrb.org/wp-content/uploads/2019/05/AO.svg',
        'rating pending': 'https://www.esrb.org/wp-content/uploads/2019/05/RP.svg'
    };

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
            const h1El = document.querySelector('h1') || 
                       document.querySelector('[data-testid="pdp-title"]') ||
                       document.querySelector('[class*="Title-"]');
            if (h1El && h1El.textContent.trim()) return h1El.textContent.trim();
        }

        return null;
    }

    function buildSearchQueries(rawTitle) {
        const queries = [rawTitle];
        const lower = rawTitle.toLowerCase();

        if (TITLE_ALIASES[lower]) {
            queries.push(...TITLE_ALIASES[lower]);
        }

        const cleanedTitle = rawTitle
            .replace(/\s*:.*$/, '')
            .replace(/\s*(?:Ultimate|GOTY|Game of the Year|Deluxe|Standard|Enhanced|Definitive|Remastered|Digital Deluxe|Rebirth Expansion|Expansion|DLC)\s*(?:Edition)?/gi, '')
            .replace(/\s*\(.*\)$/, '')
            .trim();

        if (cleanedTitle && cleanedTitle !== rawTitle) {
            queries.push(cleanedTitle);
        }

        return [...new Set(queries)];
    }

    function searchESRB(query) {
        return new Promise((resolve) => {
            const url = `https://www.esrb.org/search/?searchKeyword=${encodeURIComponent(query)}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(response.responseText, 'text/html');
                            const results = [];

                            const gameEntries = doc.querySelectorAll('.game, article, tr, .search-result');
                            
                            gameEntries.forEach(card => {
                                const link = card.querySelector('a[href*="/ratings/"]') || card.querySelector('a');
                                if (!link) return;

                                const title = link.innerText.trim();
                                const textContent = card.innerText || '';
                                const img = card.querySelector('img[src*="rating"], img[alt*="Rating"], img[src*="uploads"]');
                                
                                let rating = img ? (img.alt || img.src.split('/').pop().replace(/\..*$/, '')) : '';
                                
                                if (!rating) {
                                    if (/everyone 10\+/i.test(textContent)) rating = 'Everyone 10+';
                                    else if (/everyone/i.test(textContent)) rating = 'Everyone';
                                    else if (/teen/i.test(textContent)) rating = 'Teen';
                                    else if (/mature 17\+/i.test(textContent)) rating = 'Mature 17+';
                                    else if (/adults only/i.test(textContent)) rating = 'Adults Only';
                                    else if (/rating pending/i.test(textContent)) rating = 'Rating Pending';
                                }

                                const commonTerms = [
                                    'Alcohol Reference', 'Animated Blood', 'Blood', 'Blood and Gore', 
                                    'Cartoon Violence', 'Comic Mischief', 'Crude Humor', 'Drug Reference', 
                                    'Fantasy Violence', 'Intense Violence', 'Language', 'Lyrics', 
                                    'Nudity', 'Partial Nudity', 'Real Gambling', 'Sexual Content', 
                                    'Sexual Themes', 'Sexual Violence', 'Simulated Gambling', 
                                    'Strong Language', 'Strong Lyrics', 'Strong Sexual Content', 
                                    'Suggestive Themes', 'Tobacco Reference', 'Use of Alcohol', 
                                    'Use of Drugs', 'Use of Tobacco', 'Violence'
                                ];
                                const descriptors = commonTerms.filter(term => new RegExp(`\\b${term}\\b`, 'i').test(textContent));

                                if (title && rating) {
                                    results.push({
                                        title: title,
                                        rating: rating.replace(/^ESRB\s*/i, ''),
                                        platforms: textContent,
                                        descriptors: descriptors,
                                        url: link.href.startsWith('http') ? link.href : `https://www.esrb.org${link.getAttribute('href')}`
                                    });
                                }
                            });

                            resolve(results);
                            return;
                        } catch (e) {
                            console.error('ESRB Parse Error:', e);
                        }
                    }
                    resolve([]);
                },
                onerror: () => resolve([])
            });
        });
    }

    function evaluateBestMatch(results, searchTitle) {
        if (!results || results.length === 0) return null;

        const targetLower = searchTitle.toLowerCase().trim();
        // Extract alphanumeric words for fuzzy relevancy checking
        const targetWords = targetLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);

        // Helper to check if a result title is reasonably related to the target title
        const isRelevantMatch = (resultTitle) => {
            const resLower = resultTitle.toLowerCase().trim();
            if (resLower === targetLower || resLower.includes(targetLower) || targetLower.includes(resLower)) {
                return true;
            }
            if (targetWords.length === 0) return false;
            const resWords = resLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/);
            const matchedCount = targetWords.filter(w => resWords.includes(w)).length;
            // Require at least a strong token overlap percentage to prevent completely different games matching
            return (matchedCount / targetWords.length) >= 0.5;
        };

        // Filter results down to only relevant ones
        const validResults = results.filter(r => isRelevantMatch(r.title));
        if (validResults.length === 0) return null;

        // 1. Exact match within valid results
        const exactMatch = validResults.find(r => r.title.toLowerCase().trim() === targetLower);
        if (exactMatch) {
            return {
                rating: exactMatch.rating,
                platform: 'PC',
                matchedTitle: exactMatch.title,
                descriptors: exactMatch.descriptors,
                url: exactMatch.url
            };
        }

        // 2. Platform preference (PC, PS5, PS4)
        const platforms = [
            { key: 'pc', label: 'PC' },
            { key: 'playstation 5', label: 'PS5' },
            { key: 'ps5', label: 'PS5' },
            { key: 'playstation 4', label: 'PS4' },
            { key: 'ps4', label: 'PS4' }
        ];
        for (const p of platforms) {
            const match = validResults.find(r => r.platforms.toLowerCase().includes(p.key));
            if (match) {
                return {
                    rating: match.rating,
                    platform: p.label,
                    matchedTitle: match.title,
                    descriptors: match.descriptors,
                    url: match.url
                };
            }
        }

        // 3. Take the first valid relevant result
        return {
            rating: validResults[0].rating,
            platform: 'Console/Global',
            matchedTitle: validResults[0].title,
            descriptors: validResults[0].descriptors,
            url: validResults[0].url
        };
    }

    function injectUI(data) {
        const existingBadge = document.querySelector('#store-esrb-badge');
        if (existingBadge) existingBadge.remove();

        const ratingKey = data.rating.toLowerCase().trim();
        const iconUrl = ESRB_ICONS[ratingKey] || '';

        let descriptionHtml = '';
        if (data.descriptors && data.descriptors.length > 0) {
            descriptionHtml = `
                <div style="margin-top: 6px; font-size: 11px; line-height: 1.4; color: #a3aab3;">
                    <strong style="color: #c6d4df; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Description: </strong>${data.descriptors.join(' • ')}
                </div>
            `;
        }

        const badgeHtml = `
            <div id="store-esrb-badge" style="
                background: rgba(18, 22, 28, 0.85);
                border-left: 4px solid #67c1f5;
                padding: 12px 14px;
                margin: 12px 0 16px 0;
                border-radius: 0 6px 6px 0;
                font-family: 'Motiva Sans', sans-serif, Arial;
                color: #acb2b8;
                width: 100%;
                box-sizing: border-box;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <a href="${data.url || 'https://www.esrb.org'}" target="_blank" rel="noopener" title="View details on ESRB.org" style="
                        font-size: 11px; 
                        font-weight: bold; 
                        color: #67c1f5; 
                        text-decoration: none; 
                        letter-spacing: 0.6px;
                        display: flex;
                        align-items: center;
                        gap: 4px;">
                        ESRB RATING ↗
                    </a>
                    <span style="font-size: 10px; background: #2a475e; color: #67c1f5; padding: 2px 8px; border-radius: 3px; font-weight: bold;">${data.platform}</span>
                </div>

                <div style="display: flex; align-items: flex-start; gap: 14px;">
                    ${iconUrl ? `
                        <a href="${data.url || '#'}" target="_blank" rel="noopener" style="display: block; flex-shrink: 0;">
                            <img src="${iconUrl}" alt="${data.rating}" style="height: 72px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));" />
                        </a>` : ''}
                    <div style="flex: 1; min-width: 0; word-break: break-word;">
                        <div style="font-size: 16px; font-weight: bold; color: #ffffff; line-height: 1.2;">
                            ${data.rating}
                        </div>
                        ${data.matchedTitle ? `
                            <div style="font-size: 11px; margin-top: 4px; line-height: 1.3;">
                                <a href="${data.url || 'https://www.esrb.org'}" target="_blank" rel="noopener" style="color: #67c1f5; text-decoration: none;">
                                    ${data.matchedTitle} ↗
                                </a>
                            </div>` : ''}
                        ${descriptionHtml}
                    </div>
                </div>
            </div>
        `;

        if (IS_STEAM) {
            const steamTarget = document.querySelector('.glance_ctn') || document.querySelector('.game_meta_data');
            if (steamTarget) steamTarget.insertAdjacentHTML('afterbegin', badgeHtml);
        } else if (IS_EPIC) {
            const epicTarget = document.querySelector('aside') || document.querySelector('[data-testid="pdp-title"]')?.parentElement;
            if (epicTarget) epicTarget.insertAdjacentHTML('afterbegin', badgeHtml);
        }
    }

    async function processESRB(title) {
        isFetching = true;
        const queries = buildSearchQueries(title);
        let match = null;

        for (const q of queries) {
            const results = await searchESRB(q);
            match = evaluateBestMatch(results, q);
            if (match) break;
        }

        if (match) {
            injectUI(match);
        } else {
            injectUI({
                rating: 'Not Rated',
                platform: 'N/A',
                matchedTitle: '',
                descriptors: [],
                url: 'https://www.esrb.org'
            });
        }
        isFetching = false;
    }

    function init() {
        const title = getGameTitle();
        if (!title) return;

        if (title !== lastProcessedTitle) {
            lastProcessedTitle = title;
            const existingBadge = document.querySelector('#store-esrb-badge');
            if (existingBadge) existingBadge.remove();
        }

        if (!document.querySelector('#store-esrb-badge') && !isFetching) {
            processESRB(title);
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
