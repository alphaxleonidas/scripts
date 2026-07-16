
Violentmonkey
Installed scripts
Settings | Update | Sync
About
Recycle Bin
1
for 9 matching scripts
Sort order:
Nexus Download Collection
Drigtime0.9.1097k57d
Nexus No Wait ++
Torkelicious2.1.230k57d
Twitch Mobile/Desktop Switcher
Leonidas1.4.19k21d
GitHub Image Preview
Rob Garrison2.0.816k27d
Discord VirusTotal Link Scanner
1.89k14d
Search Each Line in New Tab
Leonidas1.24k23min
Gemini URL Search Injector & Auto-Submit
Leonidas1.24k11h
ChatGPT URL Search Injector & Auto-Submit
Leonidas1.24k11h
Octotree Dark Theme + Dark Reader Fix
You4.04k0min
Code
Settings
Values
?
Octotree Dark Theme + Dark Reader Fix
Use another editor?

1

// ==UserScript==

2

// @name         Octotree Dark Theme + Dark Reader Fix

3

// @namespace    http://tampermonkey.net/

4

// @version      4.0

5

// @description  Dark Octotree sidebar with Dark Reader compatibility

6

// @author       You

7

// @match        https://github.com/*

8

// @grant        none

9

// @run-at       document-idle

10

// ==/UserScript==

11

​

12

(function() {

13

    'use strict';

14

​

15

    // Wait for Octotree to inject sidebar

16

    function init() {

17

        const sidebar = document.querySelector('.octotree-sidebar');

18

        if (!sidebar) {

19

            setTimeout(init, 500);

20

            return;

21

        }

22

​

23

        // Tell Dark Reader to ignore the sidebar and all its children

24

        sidebar.setAttribute('data-darkreader-ignore', 'true');

25

​

26

        // Apply our dark theme

27

        applyStyles(sidebar);

28

    }

29

​

30

    function applyStyles(sidebar) {

31

        const css = `

32

            .octotree-sidebar { background: #0d1117 !important; border-right: 1px solid #30363d !important; color: #c9d1d9 !important; }

33

            .octotree-toggle { background: #161b22 !important; border-bottom: 1px solid #30363d !important; }

34

            .octotree-toggle__brand { color: #c9d1d9 !important; }

35

            .octotree-toggle__brand span { color: #58a6ff !important; }

36

            .octotree-view-header { background: #161b22 !important; border-bottom: 1px solid #30363d !important; }

37

            .octotree-header-repo a, .octotree-header-branch a { color: #58a6ff !important; }

38

            .octotree-icon-repo, .octotree-icon-branch, .octotree-branch-name { color: #8b949e !important; }

39

            .octotree-tree-view, .octotree-tree-view .jstree, .octotree-tree-view .jstree-container-ul { background: #0d1117 !important; }

40

            .octotree-tree-view .jstree-anchor { color: #c9d1d9 !important; }

41

            .octotree-tree-view .jstree-anchor:hover { background: #1f2428 !important; color: #f0f6fc !important; }

42

            .octotree-tree-view .jstree-clicked { background: rgba(31,111,235,0.2) !important; color: #58a6ff !important; }

43

            .octotree-tree-view .jstree-icon, .octotree-tree-view .jstree-themeicon { color: #8b949e !important; }

44

            .octotree-settings-view { background: #0d1117 !important; color: #c9d1d9 !important; }

45

            .octotree-settings-view input, .octotree-settings-view textarea, .octotree-settings-view select { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; }

46

            .octotree-settings-view .btn-primary { background: #238636 !important; border-color: #2ea043 !important; color: #fff !important; }

47

            .octotree-footer { background: #161b22 !important; border-top: 1px solid #30363d !important; }

48

            .octotree-footer-login a { color: #58a6ff !important; }

49

            .octotree-ads { background: #161b22 !important; border-color: #30363d !important; color: #c9d1d9 !important; }

50

            .octotree-ads a { color: #58a6ff !important; }

51

            .ui-resizable-e { background: #30363d !important; }

52

            .octotree-error-view { background: #0d1117 !important; color: #c9d1d9 !important; }

53

            .octotree-error-view .message { color: #f85149 !important; }

54

        `;

55

​

56

        const style = document.createElement('style');

57

        style.textContent = css;

58

        sidebar.appendChild(style);

59

    }

60

​

61

    init();

62

})();

