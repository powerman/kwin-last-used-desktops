'use strict';

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
        this.desktopNumberMap = {};

        /** @type {string[]} History of desktop IDs (UUID strings) in usage order. */
        this.desktopHistory = [workspace.currentDesktop.id];
        /** @type {number} Current position in history during navigation. */
        this.historyIndex = 0;

        /** @type {number} Delay in ms to detect continuation of shortcut presses. */
        this.continuationDelay = 500;
        /** @type {number} Timestamp of last shortcut trigger. */
        this.lastTriggerTime = 0;

        /** @type {string|null} Desktop ID buffered during navigation sequence. */
        this.navigationBuffer = null;

        this.buildDesktopNumberMap();
        this.connectSignals();
        this.registerShortcuts();

        this.log(`Initialized with desktop ${this.desktopHistory[0]}`);
    }

    /**
     * Logs with script name prefix.
     * @param {string} msg - Log message.
     * @param {...any} args - Additional values.
     * @private
     */
    log(msg, ...args) {
        console.log(`LastUsedDesktops: ${msg}`, ...args);
    }

    /**
     * Build mapping between x11DesktopNumber and desktop ID (UUID).
     * @private
     */
    buildDesktopNumberMap() {
        this.log(`Building desktop number map for ${workspace.desktops.length} desktops`);

        this.desktopNumberMap = {};
        for (let i = 0; i < workspace.desktops.length; i++) {
            const desktop = workspace.desktops[i];
            const desktopNumber = desktop.x11DesktopNumber || i + 1;
            this.desktopNumberMap[desktopNumber] = desktop.id;
            this.log(`Desktop ${desktopNumber} -> ${desktop.id}`);
        }
    }

    /**
     * Connect to KWin signals.
     * @private
     */
    connectSignals() {
        workspace.currentDesktopChanged.connect(desktop => {
            this.addToHistory(desktop.id);
        });

        workspace.desktopsChanged.connect(() => {
            this.log('Desktops changed, rebuilding map');
            this.buildDesktopNumberMap();
            this.cleanupHistory();
        });
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

        this.log(`Registering shortcuts for ${workspace.desktops.length} desktops`);

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
     * Handle direct desktop navigation with toggle functionality.
     * @param {number} desktopNumber - Target desktop number (1-based).
     * @private
     */
    handleDirectDesktopNavigation(desktopNumber) {
        const targetDesktopId = this.desktopNumberMap[desktopNumber];

        if (!targetDesktopId) {
            this.log(`Desktop ${desktopNumber} not found`);
            return;
        }

        if (!this.desktopExists(targetDesktopId)) {
            this.log(`Desktop ${desktopNumber} (${targetDesktopId}) no longer exists`);
            this.buildDesktopNumberMap(); // Rebuild map.
            return;
        }

        const currentDesktopId = workspace.currentDesktop.id;

        // Toggle logic: if already on target desktop, go to previous.
        if (currentDesktopId === targetDesktopId) {
            this.log(`Already on desktop ${desktopNumber}, switching to previous`);

            // For toggle, we want to go to the most recent desktop that's not the current one.
            // Don't use handleHistoryNavigation() as it has complex continuation logic.

            // Find the most recent desktop in history that's not the current one.
            let previousDesktopId = null;
            for (let i = this.desktopHistory.length - 1; i >= 0; i--) {
                const desktopId = this.desktopHistory[i];
                if (desktopId !== currentDesktopId && this.desktopExists(desktopId)) {
                    previousDesktopId = desktopId;
                    break;
                }
            }

            if (previousDesktopId) {
                this.navigateToDesktop(previousDesktopId);
            } else {
                this.log('No previous desktop available for toggle');
            }
        } else {
            this.log(`Navigating to desktop ${desktopNumber}`);
            this.navigateToDesktop(targetDesktopId);
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

        this.log(
            `Added desktop ${desktopId} to history. Current history length: ${this.desktopHistory.length}`,
        );
    }

    /**
     * Clean up history by removing non-existent desktops.
     * @private
     */
    cleanupHistory() {
        const originalLength = this.desktopHistory.length;
        this.desktopHistory = this.desktopHistory.filter(desktopId =>
            this.desktopExists(desktopId),
        );

        if (this.desktopHistory.length < originalLength) {
            this.log(
                `Cleaned up history, removed ${originalLength - this.desktopHistory.length} invalid desktops`,
            );
        }
    }

    /**
     * Check if this shortcut press is a continuation of previous navigation.
     * @returns {boolean} True if this is a continuation.
     * @private
     */
    isContinuation() {
        const now = Date.now();
        const timeDiff = now - this.lastTriggerTime;
        this.lastTriggerTime = now;

        return timeDiff < this.continuationDelay;
    }

    /**
     * Handle history navigation shortcut.
     * @private
     */
    handleHistoryNavigation() {
        const currentDesktopId = workspace.currentDesktop.id;

        // Clean up history before navigation.
        this.cleanupHistory();

        const isContinuing = this.isContinuation();
        this.log(`Navigation triggered (continuing: ${isContinuing})`);

        let targetDesktopId;

        if (isContinuing) {
            // During continued navigation, increment the index and get next desktop.
            targetDesktopId = this.getNextHistoryDesktop(currentDesktopId);
        } else {
            // First press - commit any buffered navigation and start fresh.
            this.commitNavigationBuffer();

            // Add current desktop to history only on first press if not already there.
            if (!this.desktopHistory.includes(currentDesktopId)) {
                this.addToHistory(currentDesktopId);
            }

            this.historyIndex = 1; // Start with previous desktop.
            targetDesktopId = this.getDesktopFromHistory(this.historyIndex);
        }

        if (this.desktopExists(targetDesktopId)) {
            this.log(`Navigating to desktop ${targetDesktopId}`);
            this.navigateToDesktop(targetDesktopId);
            this.navigationBuffer = targetDesktopId;
        } else {
            this.log(`Cannot navigate to desktop ${targetDesktopId}`);
        }
    }

    /**
     * Get the next desktop in history for continued navigation.
     * @param {string} _currentDesktopId - Current desktop ID (unused).
     * @returns {string|null} Next desktop ID or null.
     * @private
     */
    getNextHistoryDesktop(_currentDesktopId) {
        // During continued navigation, just increment the index.
        this.historyIndex++;
        return this.getDesktopFromHistory(this.historyIndex);
    }

    /**
     * Get desktop ID from history at given index.
     * @param {number} index - Index in history (1 = previous, 2 = before previous, etc.).
     * @returns {string|null} Desktop ID or null if not available.
     * @private
     */
    getDesktopFromHistory(index) {
        if (this.desktopHistory.length < index + 1) {
            return null; // Not enough history.
        }

        const historyIndex = this.desktopHistory.length - 1 - index;

        if (historyIndex < 0) {
            return null; // Index out of bounds.
        }

        return this.desktopHistory[historyIndex];
    }

    /**
     * Check if desktop with given ID exists.
     * @param {string} desktopId - Desktop ID to check.
     * @returns {boolean} True if desktop exists.
     * @private
     */
    desktopExists(desktopId) {
        if (!workspace.desktops) {
            return false;
        }

        return workspace.desktops.some(desktop => desktop && desktop.id === desktopId);
    }

    /**
     * Navigate to specified desktop.
     * @param {string} desktopId - Target desktop ID.
     * @private
     */
    navigateToDesktop(desktopId) {
        const targetDesktop = workspace.desktops.find(
            desktop => desktop && desktop.id === desktopId,
        );

        if (!targetDesktop) {
            this.log(`Desktop ${desktopId} not found`);
            return;
        }

        this.log(`Navigating to desktop ${desktopId}`);

        workspace.currentDesktop = targetDesktop;
    }

    /**
     * Commit buffered navigation to history.
     * @private
     */
    commitNavigationBuffer() {
        if (this.navigationBuffer !== null) {
            // Only add to history if it's not already the last entry.
            const lastEntry = this.desktopHistory[this.desktopHistory.length - 1];
            if (lastEntry !== this.navigationBuffer) {
                this.addToHistory(this.navigationBuffer);
            }
            this.navigationBuffer = null;
        }
        // Reset navigation state.
        this.historyIndex = 0;
    }
}

// Initialize the script.
const lastUsedDesktops = new LastUsedDesktops();

// Export for tests.
if (typeof globalThis !== 'undefined') {
    globalThis.lastUsedDesktops = lastUsedDesktops;
}
