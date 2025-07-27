'use strict';

const SCRIPT_VERSION = 'v0.3.0';

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
        /** @type {Object<number, string>} Map of x11DesktopNumber to desktop ID. */
        this.desktopID = {};
        /** @type {Object<string, number>} Map of desktop ID to x11DesktopNumber. */
        this.desktopNum = {};

        /** @type {string[]} History of desktop IDs (UUID strings) in usage order. */
        this.desktopHistory = [workspace.currentDesktop.id];
        /** @type {number} Current position in history during navigation. */
        this.historyIndex = 0;
        /** @type {string|null} Desktop ID candidate during navigation sequence. */
        this.targetDesktopId = null;

        /** @type {number} Delay in ms to detect continuation of shortcut presses. */
        this.continuationDelay = readConfig('continuationDelay', 500);
        /** @type {number} Timestamp of last shortcut trigger. */
        this.lastTriggerTime = 0;

        /** @type {boolean} */
        this.debugEnabled = readConfig('debugEnabled', false);

        this.debug(`Starting ${SCRIPT_VERSION}`);

        this.initDesktops();

        this.connectSignals();
        this.registerShortcuts();
    }

    /**
     * Logs with script name prefix.
     * @param {string} msg - Log message.
     * @param {...any} args - Additional values.
     * @private
     */
    debug(msg, ...args) {
        if (this.debugEnabled) {
            console.log(`LastUsedDesktops: ${msg}`, ...args);
        }
    }

    /**
     * Describes desktop by ID.
     * @param {string} id - Desktop ID (UUID).
     * @returns {string} - "desktop {number} {id}".
     * @private
     */
    desc(id) {
        const desktopNum = this.desktopNum[id];
        if (desktopNum) {
            return `desktop ${desktopNum}`;
        } else {
            return `desktop ${id}`;
        }
    }

    /**
     * Initialize desktops.
     * @private
     */
    initDesktops() {
        this.buildDesktopMap();
        this.resetHistory();
    }

    /**
     * Reset the desktop history to the current desktop.
     * @private
     */
    resetHistory() {
        this.desktopHistory = [workspace.currentDesktop.id];
        this.historyIndex = 0;
        this.targetDesktopId = null;
        this.debug(`Reset history to [${this.desc(this.desktopHistory[0])}]`);
    }

    /**
     * Build mapping between x11DesktopNumber and desktop ID (UUID).
     * @private
     */
    buildDesktopMap() {
        this.debug(`Building desktop map for ${workspace.desktops.length} desktops`);
        this.desktopID = {};
        this.desktopNum = {};
        for (let i = 0; i < workspace.desktops.length; i++) {
            const desktop = workspace.desktops[i];
            const desktopNum = desktop.x11DesktopNumber || i + 1;
            this.desktopID[desktopNum] = desktop.id;
            this.desktopNum[desktop.id] = desktopNum;
            this.debug(`Added desktop ${desktopNum} ${desktop.id}`);
        }
    }

    /**
     * Connect to KWin signals.
     * @private
     */
    connectSignals() {
        workspace.desktopsChanged.connect(this.handleDesktopsChanged.bind(this));
        workspace.currentDesktopChanged.connect(this.handleCurrentDesktopChanged.bind(this));
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
            () => this.handleHistoryNavigation(),
        );

        this.debug(`Registering shortcuts for ${workspace.desktops.length} desktops`);
        for (let i = 1; i <= Math.max(20, workspace.desktops.length); i++) {
            registerShortcut(
                `Go to Desktop ${i}`,
                `Navigate to virtual desktop ${i} with toggle`,
                '', // No default hotkey - user assigns in System Settings.
                () => this.handleDirectDesktopNavigation(i),
            );
        }
    }

    /**
     * Handle workspace.desktopsChanged signal.
     * @private
     */
    handleDesktopsChanged() {
        this.debug('Event: Desktops changed');
        this.initDesktops();
    }

    /**
     * Handle workspace.currentDesktopChanged signal.
     * @param {KWin.VirtualDesktop} prevDesktop
     * @private
     */
    handleCurrentDesktopChanged(prevDesktop) {
        this.debug(
            `Event: Current desktop has changed from ${this.desc(prevDesktop.id)} to ${this.desc(workspace.currentDesktop.id)}`,
        );
        this.setCurrentDesktop();
    }

    /**
     * Handle history navigation shortcut.
     * @private
     */
    handleHistoryNavigation() {
        const now = Date.now();
        const timeDiff = now - this.lastTriggerTime;
        this.lastTriggerTime = now;
        const isContinuing = timeDiff < this.continuationDelay;

        this.debug(`Hotkey: History navigation (continuing: ${isContinuing})`);
        this.historyNavigation(isContinuing);
    }

    /**
     * Handle direct desktop navigation with toggle functionality.
     * @param {number} desktopNum - Target desktop number (1-based).
     * @private
     */
    handleDirectDesktopNavigation(desktopNum) {
        this.debug(`Hotkey: Direct navigation to ${desktopNum}`);
        this.directNavigation(desktopNum);
    }

    /**
     * Set the current desktop and update history if needed.
     * @private
     */
    setCurrentDesktop() {
        const id = workspace.currentDesktop.id;
        // Skip recording if it may be a non-final target (during continuing navigation).
        if (this.targetDesktopId === null || this.targetDesktopId !== id) {
            this.commitTargetDesktopId();
            this.addToHistory(id);
        } else {
            this.debug(`Skipping history update for ${this.desc(id)} (continuing navigation)`);
        }
    }

    /**
     * History navigation.
     * @param {boolean} isContinuing - True if this is a continuation of previous navigation.
     * @private
     */
    historyNavigation(isContinuing) {
        if (isContinuing) {
            this.historyIndex--;
        } else {
            // First press - commit any buffered navigation and start fresh.
            this.commitTargetDesktopId();

            this.historyIndex = this.desktopHistory.length - 2;
        }

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        }
        this.targetDesktopId = this.desktopHistory[this.historyIndex];

        this.navigateToDesktop(this.targetDesktopId);
    }

    /**
     * Direct navigation with toggle functionality.
     * @param {number} desktopNum - Target desktop number (1-based).
     * @private
     */
    directNavigation(desktopNum) {
        const targetDesktopId = this.desktopID[desktopNum];

        if (!targetDesktopId) {
            this.debug(`Desktop ${desktopNum} not found`);
            return;
        }

        const currentDesktopId = workspace.currentDesktop.id;

        // Toggle logic: if already on target desktop, go to previous.
        if (currentDesktopId !== targetDesktopId) {
            this.navigateToDesktop(targetDesktopId);
        } else {
            this.debug(`Already on desktop ${desktopNum}, switching to previous`);
            this.lastTriggerTime = 0; // Handle as a first press.
            this.handleHistoryNavigation();
        }
    }

    /**
     * Add desktop to history, maintaining proper order and removing duplicates.
     * @param {string} desktopId - UUID of the desktop to add.
     * @private
     */
    addToHistory(desktopId) {
        // Remove desktop if it already exists in history.
        const existingIndex = this.desktopHistory.indexOf(desktopId);
        if (existingIndex !== -1) {
            this.desktopHistory.splice(existingIndex, 1);
        }

        // Add to end of history (most recent).
        this.desktopHistory.push(desktopId);

        this.debug(`Added ${this.desc(desktopId)} to history (size=${this.desktopHistory.length})`);
    }

    /**
     * Navigate to specified desktop.
     * @param {string} desktopId - Target desktop ID.
     * @private
     */
    navigateToDesktop(desktopId) {
        const targetDesktop = workspace.desktops.find(desktop => desktop.id === desktopId);
        if (targetDesktop) {
            this.debug(`Navigating to ${this.desc(desktopId)}`);
            workspace.currentDesktop = targetDesktop;
        } else {
            this.debug(`Navigating to ${this.desc(desktopId)} failed: desktop not found`);
        }
    }

    /**
     * Commit buffered navigation to history.
     * @private
     */
    commitTargetDesktopId() {
        if (this.targetDesktopId !== null) {
            this.addToHistory(this.targetDesktopId);
            this.targetDesktopId = null;
        }
    }
}

// Initialize the script.
const script = new LastUsedDesktops();
if (typeof globalThis !== 'undefined') {
    // @ts-ignore - Node.js/Jest export for tests
    globalThis.lastUsedDesktops = script;
}
