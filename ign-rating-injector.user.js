  // ==UserScript==


// @name         Steam & Epic IGN Rating & Extra Info Display


// @namespace    http://tampermonkey.net/


// @version      1.9.2


// @description  Displays IGN review scores, user ratings, clickable HLTB with dynamic category data, Developer, and prominent ESRB rating with content descriptors.


// @author       Leonidas


// @match        https://*.steampowered.com/*


// @match        https://*.epicgames.com/*


// @grant        GM_xmlhttpRequest


// @grant        GM_getValue


// @grant        GM_setValue


// @grant        GM_registerMenuCommand


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



    // ---- Configuration Defaults & Settings Management ----


    const CONFIG_KEYS = {


        showIgnScore: 'Show IGN Score',


        showUserRating: 'Show User Rating',


        showHltb: 'Show HowLongToBeat',


        showDeveloper: 'Show Developer',


        showEsrb: 'Show ESRB Rating & Descriptors',


        showAward: 'Show IGN Award / Leaderboard'


    };



    const CONFIG_DEFAULTS = {


        showIgnScore: true,


        showUserRating: true,


        showHltb: true,


        showDeveloper: true,


        showEsrb: true,


        showAward: true


    };



    function getConfig(key) {


        return GM_getValue(key, CONFIG_DEFAULTS[key]);


    }



    function toggleConfig(key) {


        const current = getConfig(key);


        const newVal = !current;


        GM_setValue(key, newVal);


        alert(`IGN Script: "${CONFIG_KEYS[key]}" set to ${newVal ? 'Enabled' : 'Disabled'}. Refresh page to apply.`);


    }



    if (typeof GM_registerMenuCommand !== 'undefined') {


        for (const [key, label] of Object.entries(CONFIG_KEYS)) {


            GM_registerMenuCommand(`Toggle: ${label}`, () => toggleConfig(key));


        }


    }



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



    // 3. Targets placement


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



    // 4. Render Combined Badge


    function renderCompleteBadge(ignScore, userScore, hltbData, speedrunData, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, ignUrl, fetchedGameTitle = '') {


        const targetObj = getTargetInsertionPoint();


        if (!targetObj) return;



        const existingBadge = document.querySelector('.ign_rating_row');


        if (existingBadge) existingBadge.remove();



        let displayName = fetchedGameTitle;


        if (!displayName) {


            let slugPart = ignUrl.split('/games/')[1] || '';


            displayName = slugPart.replace(/-/g, ' ');


            displayName = displayName.replace(/\b\w/g, l => l.toUpperCase());


        }



        const badgeCtn = document.createElement('div');


        badgeCtn.className = 'ign_rating_row';


        badgeCtn.style.cssText = `


            margin: 10px auto;


            padding: 14px 16px;


            background: linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(35, 35, 35, 0.95));


            border-radius: 8px;


            border-left: 5px solid #ff3e3e;


            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);


            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;


            width: 100%;


            box-sizing: border-box;


            display: flex;


            flex-direction: column;


            gap: 12px;


            clear: both;


            color: #ffffff;


        `;



        // Top row: IGN title/link & balanced larger scores


        const showIgn = getConfig('showIgnScore');


        const showUser = getConfig('showUserRating');


        let topRowHtml = '';



        if (showIgn || showUser) {


            let scoresHtml = '';


            if (showIgn) {


                scoresHtml += `


                    <div style="display: flex; flex-direction: column; align-items: center;">


                        <span style="font-size: 18px; font-weight: bold; color: #ffffff; line-height: 1.1;">${escapeHtml(ignScore)}</span>


                        <span style="font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; margin-top: 3px;">IGN Score</span>


                    </div>


                `;


            }


            if (showIgn && showUser) {


                scoresHtml += `<div style="border-left: 1px solid rgba(255, 255, 255, 0.2); height: 32px;"></div>`;


            }


            if (showUser) {


                scoresHtml += `


                    <div style="display: flex; flex-direction: column; align-items: center;">


                        <span style="font-size: 18px; font-weight: bold; color: #ffffff; line-height: 1.1;">${escapeHtml(userScore)}</span>


                        <span style="font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; margin-top: 3px;">User Rating</span>


                    </div>


                `;


            }



            topRowHtml = `


                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">


                    <div style="display: flex; flex-direction: column; align-items: flex-start; justify-content: center; max-width: 130px; overflow: hidden;">


                        <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="


                            font-weight: bold;


                            color: #ff3e3e;


                            font-size: 13px;


                            letter-spacing: 0.5px;


                            text-transform: uppercase;


                            text-decoration: none;


                            white-space: nowrap;


                        ">


                            IGN Overview ↗


                        </a>


                        <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(displayName)}" style="


                            font-size: 10px;


                            color: #b8b8b8;


                            text-decoration: none;


                            white-space: nowrap;


                            overflow: hidden;


                            text-overflow: ellipsis;


                            width: 100%;


                            margin-top: 2px;


                        ">


                            ${escapeHtml(displayName)} ↗


                        </a>


                    </div>


                    <div style="display: flex; align-items: center; gap: 14px;">


                        ${scoresHtml}


                    </div>


                </div>


            `;


        }



        // Leaderboard / Award Row (Subtle, non-intrusive)


        let awardRowHtml = '';


        if (getConfig('showAward') && awardData) {


            awardRowHtml = `


                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="


                    border-top: 1px solid rgba(255, 255, 255, 0.1);


                    display: flex;


                    align-items: center;


                    justify-content: space-between;


                    font-size: 11px;


                    text-decoration: none;


                    background: rgba(255, 255, 255, 0.02);


                    padding: 4px 6px;


                    border-radius: 4px;


                ">


                    <span style="color: #8f98a0; font-weight: bold;">IGN Leaderboard Rank:</span>


                    <span style="color: #f1c40f; font-weight: bold;">


                        #${escapeHtml(awardData.rank)} (${escapeHtml(awardData.label)}) ↗


                    </span>


                </a>


            `;


        }



        // ESRB Content Rating & Descriptors (Logo higher & formatted layout)


        let esrbRowHtml = '';


        const showEsrb = getConfig('showEsrb');


        if (showEsrb && (esrbImgSrc || esrbDescriptors)) {


            esrbRowHtml = `


                <div style="border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 10px; display: flex; align-items: flex-start; gap: 12px;">


                    ${esrbImgSrc ? `<img src="${esrbImgSrc}" alt="${escapeHtml(esrbAlt)}" title="${escapeHtml(esrbAlt)}" style="height: 56px; border-radius: 4px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.3);" />` : ''}


                    <div style="display: flex; flex-direction: column; justify-content: flex-start; gap: 2px; flex: 1;">


                        <span style="color: #ffffff; font-size: 13px; font-weight: bold; line-height: 1.2;">${escapeHtml(esrbAlt)}</span>


                        ${esrbDescriptors ? `<span style="color: #d0d0d0; font-size: 10px; line-height: 1.3; margin-top: 2px;"><strong>Description:</strong> ${escapeHtml(esrbDescriptors)}</span>` : ''}


                    </div>


                </div>


            `;


        }



        // Developer Row


        let devRowHtml = '';


        const showDev = getConfig('showDeveloper');


        if (showDev && developerName) {


            devRowHtml = `


                <div style="border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">


                    <span style="color: #a1b0bd; font-weight: bold;">Developer:</span>


                    <span style="color: #c6d4df; font-weight: 500;" title="${escapeHtml(developerName)}">${escapeHtml(developerName)}</span>


                </div>


            `;


        }



        // Clickable HLTB & Speedrun Row


        let hltbRowHtml = '';


        if (getConfig('showHltb') && ((hltbData && hltbData.length > 0) || speedrunData)) {


            let hltbBlockHtml = '';



            if (hltbData && hltbData.length > 0) {


                let hltbItemsHtml = hltbData.map(item => `


                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1; text-align: center;">


                        <span style="font-size: 13px; font-weight: bold; color: #66c0f4; line-height: 1;">${escapeHtml(item.time)}</span>


                        <span style="font-size: 8px; color: #a1b0bd; text-transform: uppercase; margin-top: 3px; white-space: nowrap; font-weight: bold;">${escapeHtml(item.label)}</span>


                    </div>


                `).join('<div style="border-left: 1px solid rgba(255, 255, 255, 0.15); height: 26px;"></div>');



                hltbBlockHtml += `


                    <div style="display: flex; flex-direction: column; gap: 4px;">


                        <div style="display: flex; justify-content: space-between; align-items: center;">


                            <span style="font-size: 10px; color: #66c0f4; text-transform: uppercase; font-weight: bold;">⏳ HowLongToBeat ↗</span>


                        </div>


                        <div style="display: flex; align-items: center; justify-content: space-around; background: rgba(0, 0, 0, 0.4); padding: 8px 4px; border-radius: 4px;">


                            ${hltbItemsHtml}


                        </div>


                    </div>


                `;


            }



            if (speedrunData) {


                hltbBlockHtml += `


                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">


                        <div style="display: flex; justify-content: space-between; align-items: center;">


                            <span style="font-size: 10px; color: #f39c12; text-transform: uppercase; font-weight: bold;">Speedruns (${escapeHtml(speedrunData.category)}) ↗</span>


                        </div>


                        <div style="display: flex; align-items: center; justify-content: space-around; background: rgba(0, 0, 0, 0.4); padding: 8px 4px; border-radius: 4px;">


                            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; text-align: center;">


                                <span style="font-size: 12px; font-weight: bold; color: #f39c12; line-height: 1;">${escapeHtml(speedrunData.average)}</span>


                                <span style="font-size: 8px; color: #a1b0bd; text-transform: uppercase; margin-top: 3px; font-weight: bold;">Average</span>


                            </div>


                            <div style="border-left: 1px solid rgba(255, 255, 255, 0.15); height: 26px;"></div>


                            <div style="display: flex; flex-direction: column; align-items: center; flex: 1; text-align: center;">


                                <span style="font-size: 12px; font-weight: bold; color: #2ecc71; line-height: 1;">${escapeHtml(speedrunData.fastest)}</span>


                                <span style="font-size: 8px; color: #a1b0bd; text-transform: uppercase; margin-top: 3px; font-weight: bold;">Fastest</span>


                            </div>


                        </div>


                    </div>


                `;


            }



            hltbRowHtml = `


                <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="


                    border-top: 1px solid rgba(255, 255, 255, 0.15);


                    padding-top: 10px;


                    display: flex;


                    flex-direction: column;


                    gap: 6px;


                    text-decoration: none;


                    background: rgba(102, 192, 244, 0.03);


                    padding: 8px;


                    border-radius: 6px;


                    transition: background 0.2s;


                " onmouseover="this.style.background='rgba(102, 192, 244, 0.08)'" onmouseout="this.style.background='rgba(102, 192, 244, 0.03)'">


                    ${hltbBlockHtml}


                </a>


            `;


        }



        badgeCtn.innerHTML = topRowHtml + awardRowHtml + esrbRowHtml + devRowHtml + hltbRowHtml;



        if (!badgeCtn.innerHTML.trim()) return;



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



    // 5. Network Request & Parsers


    function fetchIGNData(gameTitle) {


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


                renderCompleteBadge('N/A', 'N/A', [], null, '', '', '', '', null, urlsToTry[0] || 'https://www.ign.com', gameTitle);


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


                        renderCompleteBadge('N/A', 'N/A', [], null, '', '', '', '', null, targetUrl, gameTitle);


                        isFetching = false;


                        return;


                    }



                    const parser = new DOMParser();


                    const doc = parser.parseFromString(response.responseText, 'text/html');



                    let fetchedGameTitle = '';


                    const h1TitleEl = doc.querySelector('h1[data-cy="object-header-display-title"]') || doc.querySelector('h1.display-title');


                    if (h1TitleEl && h1TitleEl.textContent.trim()) {


                        fetchedGameTitle = h1TitleEl.textContent.trim();


                    }



                    // Extract IGN Score


                    let ignScore = 'N/A';


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



                    // Extract User Score


                    let userScore = 'N/A';


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



                    // Extract Developer Name


                    let developerName = '';


                    const devEl = doc.querySelector('[data-cy="developerLink"]') ||


                                    doc.querySelector('a[href*="/games/developer/"]') ||


                                    doc.querySelector('[data-cy="producerLink"]') ||


                                    doc.querySelector('a[href*="/games/producer/"]');


                    if (devEl && devEl.textContent.trim()) {


                        developerName = devEl.textContent.trim();


                    }



                    // Extract ESRB Rating & Rich Content Descriptors


                    let esrbImgSrc = '';


                    let esrbAlt = '';


                    let esrbDescriptors = '';


                    const esrbImgEl = doc.querySelector('img[data-cy^="icon-esrb"]') || doc.querySelector('img[alt*="ESRB:"]');


                    if (esrbImgEl) {


                        esrbImgSrc = esrbImgEl.getAttribute('src');


                        esrbAlt = esrbImgEl.getAttribute('alt') || 'ESRB Rating';


                    }



                    if (esrbAlt && esrbAlt.includes(':')) {


                        const parts = esrbAlt.split(':');


                        esrbAlt = parts[0].trim();


                        if (parts.length > 1) {


                            esrbDescriptors = parts[1].trim();


                        }


                    }


                    if (!esrbDescriptors) {


                        const descContainer = doc.querySelector('[data-cy*="esrb-descriptors"]') || doc.querySelector('.esrb-descriptors');


                        if (descContainer) esrbDescriptors = descContainer.textContent.trim();


                    }



                    // Extract Leaderboard / Rankings


                    let awardData = null;


                    const awardEl = doc.querySelector('figure[data-cy="review-score"].icon-award') || doc.querySelector('[class*="icon-award"]');


                    if (awardEl) {


                        const figcaption = awardEl.querySelector('figcaption');


                        const rankText = figcaption ? figcaption.textContent.trim() : '';


                        let labelType = 'Global Rank';


                        if (awardEl.className.includes('icon-award-gold')) labelType = 'Gold Rank';


                        else if (awardEl.className.includes('icon-award-silver')) labelType = 'Silver Rank';


                        else if (awardEl.className.includes('icon-award-bronze')) labelType = 'Bronze Rank';



                        if (rankText) {


                            awardData = { rank: rankText, label: labelType };


                        }


                    }



                    // HLTB Data Extraction Logic (Updated)


                    let hltbData = [];


                    const hltbContent = doc.querySelector('[data-cy="hl2b-content"]') || doc.querySelector('.hl2b-content');


                    if (hltbContent) {


                        const metaItems = hltbContent.querySelectorAll('.meta-item, [data-cy$="meta-item"]');


                        metaItems.forEach(item => {


                            const timeEl = item.querySelector('.title4, [data-cy="title4"]');


                            const captionEl = item.querySelector('.caption, [data-cy="caption"]');


                            if (timeEl && captionEl) {


                                hltbData.push({


                                    time: timeEl.textContent.trim(),


                                    label: captionEl.textContent.trim()


                                });


                            }


                        });


                    }



                    // Extract Speedrun Data


                    let speedrunData = null;


                    const speedrunTable = doc.querySelector('table[class*="GameTimeTable"]');


                    if (speedrunTable) {


                        const firstRow = speedrunTable.querySelector('tbody tr.spreadsheet');


                        if (firstRow) {


                            const sCells = firstRow.querySelectorAll('td');


                            if (sCells.length >= 5) {


                                speedrunData = {


                                    category: sCells[0].textContent.trim(),


                                    average: sCells[2].textContent.trim(),


                                    fastest: sCells[4].textContent.trim()


                                };


                            }


                        }


                    }



                    renderCompleteBadge(ignScore, userScore, hltbData, speedrunData, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, targetUrl, fetchedGameTitle);


                    isFetching = false;


                },


                onerror: function () {


                    renderCompleteBadge('Error', 'Error', [], null, '', '', '', '', null, targetUrl, gameTitle);


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
