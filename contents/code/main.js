'use strict';

const SCRIPT_VERSION = 'v1.0.0';

/**
 * Unified debug logging function.
 * @param {string} msg
 * @param {...any} args
 */
function debug(msg, ...args) {
    if (debug.enabled) {
        console.log(`LastUsedDesktops: ${msg}`, ...args);
    }
}
debug.enabled = readConfig('debugEnabled', false);

/**
 * DesktopMap - manages mapping between desktop numbers and IDs.
 * @class DesktopMap
 */
class DesktopMap {
    constructor() {
        /** @type {Object<number, string>} Map of desktop number to ID. */
        this.desktopID = {};
        /** @type {Object<string, number>} Map of desktop ID to number. */
        this.desktopNum = {};
    }

    /**
     * Build mappings between X11 desktop numbers and desktop IDs (UUIDs).
     * @param {KWin.VirtualDesktop[]} desktops
     */
    build(desktops) {
        debug(`Building desktop map for ${desktops.length} desktops`);
        this.desktopID = {};
        this.desktopNum = {};
        for (let i = 0; i < desktops.length; i++) {
            const desktop = desktops[i];
            const desktopNum = desktop.x11DesktopNumber || i + 1;
            this.desktopID[desktopNum] = desktop.id;
            this.desktopNum[desktop.id] = desktopNum;
            debug(`Desktop added: number ${desktopNum}, id ${desktop.id}`);
        }
    }

    /**
     * Returns desktop ID by number.
     * @param {number} num
     * @returns {string|undefined}
     */
    id(num) {
        return this.desktopID[num];
    }

    /**
     * Returns a human-readable description for a desktop ID.
     * @param {string} id - Desktop ID (UUID).
     * @returns {string} Description in the format "desktop {number}" or "desktop {id}".
     */
    desc(id) {
        const desktopNum = this.desktopNum[id];
        if (desktopNum) {
            return `desktop ${desktopNum}`;
        } else {
            return `desktop ${id}`;
        }
    }
}

/**
 * ShortcutContinuation - manages timing for shortcut continuation logic.
 * @class ShortcutContinuation
 */
class ShortcutContinuation {
    constructor() {
        /** @type {number} Delay in ms to detect continuation of shortcut presses. */
        this.delay = readConfig('continuationDelay', 500);
        /** @type {number} Timestamp of the last shortcut press. */
        this.lastTime = 0;
    }

    /**
     * Checks if the current shortcut press is a continuation.
     * @returns {boolean}
     */
    isContinuing() {
        const now = Date.now();
        const timeDiff = now - this.lastTime;
        this.lastTime = now;
        return timeDiff < this.delay;
    }
}

/**
 * Last Used Virtual Desktops - KWin Script.
 *
 * Provides intelligent virtual desktop navigation through:
 * - History-based switching (switch to previously used desktop).
 * - Walk through desktop history with quick successive keypresses.
 * - Direct desktop targeting with toggle functionality.
 *
 * @class LastUsedDesktops
 */
class LastUsedDesktops {
    /**
     * Initialize the desktop navigation system.
     */
    constructor() {
        /** @type {DesktopMap} */
        this.map = new DesktopMap();
        /** @type {ShortcutContinuation} */
        this.continuation = new ShortcutContinuation();

        /** @type {string[]} History of desktop IDs in usage order (current is the last). */
        this.desktopHistory = [workspace.currentDesktop.id];
        /** @type {number|null} Candidate desktop index during (continuing) navigation. */
        this.candidateIdx = null;

        debug(`Script started (version: ${SCRIPT_VERSION})`);

        this.initDesktops();

        this.connectSignals();
        this.registerShortcuts();
    }

    /**
     * Initialize desktops.
     * @private
     */
    initDesktops() {
        this.map.build(workspace.desktops);
        this.resetHistory();
    }

    /**
     * Reset the desktop history to the current desktop.
     * @private
     */
    resetHistory() {
        this.desktopHistory = [workspace.currentDesktop.id];
        this.candidateIdx = null;
        debug(`History reset to [${this.map.desc(this.desktopHistory[0])}]`);
    }

    /**
     * Connect to KWin signals.
     * @private
     */
    connectSignals() {
        workspace.desktopsChanged.connect(this.onDesktopsChanged.bind(this));
        workspace.currentDesktopChanged.connect(this.onCurrentDesktopChanged.bind(this));
    }

    /**
     * Register keyboard shortcuts.
     * @private
     */
    registerShortcuts() {
        registerShortcut(
            'Last Used Virtual Desktops',
            'Navigate to previously used virtual desktop',
            'Meta+Tab',
            () => this.onPrevUsedDesktop(),
        );

        debug(`Registering shortcuts for ${workspace.desktops.length} desktops`);
        for (let i = 1; i <= Math.max(20, workspace.desktops.length); i++) {
            registerShortcut(
                `Go to Desktop ${i}`,
                `Navigate to virtual desktop ${i} with toggle`,
                '', // No default shortcut - user assigns in System Settings.
                () => this.onToggleDesktop(i),
            );
        }
    }

    /**
     * Handle workspace.desktopsChanged signal.
     * @private
     */
    onDesktopsChanged() {
        debug('Signal: Desktops changed');
        this.initDesktops();
    }

    /**
     * Handle workspace.currentDesktopChanged signal.
     * @param {KWin.VirtualDesktop} prevDesktop
     * @private
     */
    onCurrentDesktopChanged(prevDesktop) {
        const prev = this.map.desc(prevDesktop.id);
        const current = this.map.desc(workspace.currentDesktop.id);
        debug(`Signal: Current desktop changed from ${prev} to ${current}`);
        this.handleCurrentDesktopChanged();
    }

    /**
     * Handle history navigation shortcut.
     * @private
     */
    onPrevUsedDesktop() {
        const isContinuing = this.continuation.isContinuing();
        debug(`Shortcut: Previous used desktop (continuing: ${isContinuing})`);
        this.switchToPrevUsedDesktop(isContinuing);
    }

    /**
     * Handle direct desktop navigation with toggle functionality.
     * @param {number} desktopNum - Target desktop number (1-based).
     * @private
     */
    onToggleDesktop(desktopNum) {
        debug(`Shortcut: Toggle desktop ${desktopNum}`);
        this.toggleDesktop(desktopNum);
    }

    /**
     * Updates the desktop history after a desktop change.
     * @private
     */
    handleCurrentDesktopChanged() {
        const id = workspace.currentDesktop.id;
        if (this.candidateIdx === null || this.desktopHistory[this.candidateIdx] !== id) {
            this.finalizeContinuing();
            this.addToHistory(id);
        } else {
            debug(`Skipping adding ${this.map.desc(id)} to history (continuing navigation)`);
        }
    }

    /**
     * Handles navigation to the previously used desktop.
     * @param {boolean} isContinuing - True if this is a continuation of previous navigation.
     * @private
     */
    switchToPrevUsedDesktop(isContinuing) {
        if (isContinuing && this.candidateIdx !== null) {
            this.candidateIdx--;
        } else {
            // First press - complete continuing navigation and start fresh.
            this.finalizeContinuing();

            // Start from the previous desktop in history.
            this.candidateIdx = this.desktopHistory.length - 2;
        }

        if (this.candidateIdx < 0) {
            this.candidateIdx = 0;
        }
        this.navigateToDesktop(this.desktopHistory[this.candidateIdx]);
    }

    /**
     * Handles direct navigation to a desktop with toggle functionality.
     * @param {number} desktopNum - Target desktop number (1-based).
     * @private
     */
    toggleDesktop(desktopNum) {
        const targetID = this.map.id(desktopNum);
        const currentID = workspace.currentDesktop.id;

        this.finalizeContinuing();
        if (!targetID) {
            debug(`Desktop ${desktopNum} not found`);
        } else if (currentID !== targetID) {
            this.navigateToDesktop(targetID);
        } else {
            debug(`Already on desktop ${desktopNum}; switching to previous used desktop`);
            this.switchToPrevUsedDesktop(false);
            this.finalizeContinuing();
        }
    }

    /**
     * Finalizes continuing navigation, if active.
     * @private
     */
    finalizeContinuing() {
        if (this.candidateIdx !== null) {
            this.addToHistory(this.desktopHistory[this.candidateIdx]);
            this.candidateIdx = null;
        }
    }

    /**
     * Adds a desktop to history, maintaining order and removing duplicates.
     * @param {string} id - UUID of the desktop to add.
     * @private
     */
    addToHistory(id) {
        // Remove desktop if it already exists in history.
        const existingIndex = this.desktopHistory.indexOf(id);
        if (existingIndex !== -1) {
            this.desktopHistory.splice(existingIndex, 1);
        }

        this.desktopHistory.push(id);
        debug(`Desktop ${this.map.desc(id)} added to history (size=${this.desktopHistory.length})`);
    }

    /**
     * Navigates to the specified desktop by ID.
     * @param {string} id - Target desktop ID.
     * @private
     */
    navigateToDesktop(id) {
        const targetDesktop = workspace.desktops.find(desktop => desktop.id === id);
        if (targetDesktop) {
            debug(`Navigating to desktop ${this.map.desc(id)}`);
            workspace.currentDesktop = targetDesktop;
        } else {
            debug(`Failed to navigate to desktop ${this.map.desc(id)}: not found`);
        }
    }
}

// Initialize the script.
const script = new LastUsedDesktops();

if (typeof globalThis !== 'undefined') {
    // @ts-ignore - Node.js/Jest export for tests
    globalThis.debug = debug;
    globalThis.lastUsedDesktops = script;
}
