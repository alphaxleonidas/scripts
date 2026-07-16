// ==UserScript==
// @name         Octotree Dark Theme + Dark Reader Fix
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Dark Octotree sidebar with Dark Reader compatibility
// @author       Leonidas
// @match        https://github.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Wait for Octotree to inject sidebar
    function init() {
        const sidebar = document.querySelector('.octotree-sidebar');
        if (!sidebar) {
            setTimeout(init, 500);
            return;
        }

        // Tell Dark Reader to ignore the sidebar and all its children
        sidebar.setAttribute('data-darkreader-ignore', 'true');

        // Apply our dark theme
        applyStyles(sidebar);
    }

    function applyStyles(sidebar) {
        const css = `
            .octotree-sidebar { background: #0d1117 !important; border-right: 1px solid #30363d !important; color: #c9d1d9 !important; }
            .octotree-toggle { background: #161b22 !important; border-bottom: 1px solid #30363d !important; }
            .octotree-toggle__brand { color: #c9d1d9 !important; }
            .octotree-toggle__brand span { color: #58a6ff !important; }
            .octotree-view-header { background: #161b22 !important; border-bottom: 1px solid #30363d !important; }
            .octotree-header-repo a, .octotree-header-branch a { color: #58a6ff !important; }
            .octotree-icon-repo, .octotree-icon-branch, .octotree-branch-name { color: #8b949e !important; }
            .octotree-tree-view, .octotree-tree-view .jstree, .octotree-tree-view .jstree-container-ul { background: #0d1117 !important; }
            .octotree-tree-view .jstree-anchor { color: #c9d1d9 !important; }
            .octotree-tree-view .jstree-anchor:hover { background: #1f2428 !important; color: #f0f6fc !important; }
            .octotree-tree-view .jstree-clicked { background: rgba(31,111,235,0.2) !important; color: #58a6ff !important; }
            .octotree-tree-view .jstree-icon, .octotree-tree-view .jstree-themeicon { color: #8b949e !important; }
            .octotree-settings-view { background: #0d1117 !important; color: #c9d1d9 !important; }
            .octotree-settings-view input, .octotree-settings-view textarea, .octotree-settings-view select { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; }
            .octotree-settings-view .btn-primary { background: #238636 !important; border-color: #2ea043 !important; color: #fff !important; }
            .octotree-footer { background: #161b22 !important; border-top: 1px solid #30363d !important; }
            .octotree-footer-login a { color: #58a6ff !important; }
            .octotree-ads { background: #161b22 !important; border-color: #30363d !important; color: #c9d1d9 !important; }
            .octotree-ads a { color: #58a6ff !important; }
            .ui-resizable-e { background: #30363d !important; }
            .octotree-error-view { background: #0d1117 !important; color: #c9d1d9 !important; }
            .octotree-error-view .message { color: #f85149 !important; }
        `;

        const style = document.createElement('style');
        style.textContent = css;
        sidebar.appendChild(style);
    }

    init();
})();
