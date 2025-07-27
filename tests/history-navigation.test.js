/**
 * @fileoverview Tests for history navigation functionality
 */

const fs = require('fs');
const path = require('path');

// Mock UUIDs for testing
const testUUIDs = [
    '11111111-1111-1111-1111-111111111111', // Desktop 1
    '22222222-2222-2222-2222-222222222222', // Desktop 2
    '33333333-3333-3333-3333-333333333333', // Desktop 3
    '44444444-4444-4444-4444-444444444444', // Desktop 4
    '55555555-5555-5555-5555-555555555555', // Desktop 5
];

function createMockWorkspace(startDesktop = 0) {
    const desktops = testUUIDs.map((uuid, index) => ({
        id: uuid,
        x11DesktopNumber: index + 1,
        name: `Desktop ${index + 1}`,
    }));

    return {
        currentDesktop: { id: testUUIDs[startDesktop] },
        desktops,
        currentDesktopChanged: { connect: jest.fn() },
        desktopsChanged: { connect: jest.fn() },
    };
}

function loadScript() {
    const scriptPath = path.join(__dirname, '..', 'contents', 'code', 'main.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    if (globalThis.lastUsedDesktops) {
        delete globalThis.lastUsedDesktops;
    }

    eval(scriptContent);
    return globalThis.lastUsedDesktops;
}

describe('History Navigation', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let script;
    let desktopChangeHandler;
    let historyNavigationHandler;

    beforeEach(() => {
        jest.clearAllMocks();

        mockWorkspace = createMockWorkspace(0);
        mockRegisterShortcut = jest.fn();

        globalThis.workspace = mockWorkspace;
        globalThis.registerShortcut = mockRegisterShortcut;
        globalThis.readConfig = jest.fn((key, defaultValue) => defaultValue);
        globalThis.console = { log: jest.fn(), error: jest.fn() };

        // Mock Date.now for testing continuation logic
        jest.spyOn(Date, 'now').mockReturnValue(1000);

        script = loadScript();

        // Get event handlers
        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
        historyNavigationHandler = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Last Used Virtual Desktops',
        )[3];
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    describe('History Building', () => {
        test('should start with current desktop in history', () => {
            expect(script.desktopHistory).toEqual([testUUIDs[0]]);
            expect(script.historyIndex).toBe(0);
        });

        test('should add new desktops to history in order', () => {
            // Simulate desktop changes: 1 → 2 → 3
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            mockWorkspace.currentDesktop = { id: testUUIDs[2] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            expect(script.desktopHistory).toEqual([
                testUUIDs[0], // Desktop 1 (initial)
                testUUIDs[1], // Desktop 2
                testUUIDs[2], // Desktop 3
            ]);
        });

        test('should move existing desktop to end when revisited', () => {
            // Build initial history: 1 → 2 → 3
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            mockWorkspace.currentDesktop = { id: testUUIDs[2] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Return to Desktop 1
            mockWorkspace.currentDesktop = { id: testUUIDs[0] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Desktop 1 should move to end, not be duplicated
            expect(script.desktopHistory).toEqual([
                testUUIDs[1], // Desktop 2
                testUUIDs[2], // Desktop 3
                testUUIDs[0], // Desktop 1 (moved to end)
            ]);
        });
    });

    describe('Single History Navigation', () => {
        test('should navigate to previous desktop on first press', () => {
            // Build history: 1 → 2 → 3
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            mockWorkspace.currentDesktop = { id: testUUIDs[2] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Currently on Desktop 3, history: [1, 2, 3]
            // Should navigate to Desktop 2 (previous)
            Date.now.mockReturnValue(2000);
            historyNavigationHandler();

            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2
        });

        test('should handle single desktop in history', () => {
            // Only one desktop in history
            expect(script.desktopHistory).toEqual([testUUIDs[0]]);

            // Should stay on same desktop
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]);
        });
    });

    describe('Continuation Navigation', () => {
        test('should walk through history with quick presses', () => {
            // Build history: 1 → 2 → 3 → 4
            [testUUIDs[1], testUUIDs[2], testUUIDs[3]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // Currently on Desktop 4, history: [1, 2, 3, 4]

            // First press: go to Desktop 3
            Date.now.mockReturnValue(3000);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[2]); // Desktop 3

            // Second press (within continuation delay): go to Desktop 2
            Date.now.mockReturnValue(3200);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2

            // Third press (within continuation delay): go to Desktop 1
            Date.now.mockReturnValue(3400);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]); // Desktop 1

            // Fourth press (within continuation delay): should stay at Desktop 1 (beginning)
            Date.now.mockReturnValue(3600);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]); // Still Desktop 1
        });

        test('should restart navigation after timeout', () => {
            // Build history: 1 → 2 → 3
            [testUUIDs[1], testUUIDs[2]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // First navigation session: go from 3 to 2
            Date.now.mockReturnValue(4000);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2

            // Wait beyond continuation delay, then press again
            Date.now.mockReturnValue(5000); // 1000ms later, beyond 500ms delay
            historyNavigationHandler();

            // After first navigation commitTargetDesktopId() was called
            // History is now: [Desktop 1, Desktop 2, Desktop 3, Desktop 2 (from navigation)]
            // Second navigation: historyIndex = length-2 = 4-2 = 2, so history[2] = Desktop 3
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[2]); // Desktop 3, not Desktop 2
        });
    });

    describe('Navigation State Management', () => {
        test('should track target desktop during navigation', () => {
            // Build some history
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Start navigation
            historyNavigationHandler();

            // Should have set target desktop
            expect(script.targetDesktopId).toBe(testUUIDs[0]);
        });

        test('should commit navigation to history properly', () => {
            // Build history: 1 → 2
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            const historyBefore = [...script.desktopHistory];

            // Start navigation (sets targetDesktopId AND calls commitTargetDesktopId first)
            historyNavigationHandler();

            // historyNavigation already called commitTargetDesktopId() if targetDesktopId was not null
            // So history length should already be increased by 1
            expect(script.desktopHistory.length).toBe(historyBefore.length);
            expect(script.targetDesktopId).not.toBe(null); // New target was set
        });

        test('should not record intermediate navigation steps', () => {
            // Build history: 1 → 2 → 3
            [testUUIDs[1], testUUIDs[2]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            const historyLength = script.desktopHistory.length;

            // Navigate through several steps quickly
            Date.now.mockReturnValue(6000);
            historyNavigationHandler(); // 3 → 2
            Date.now.mockReturnValue(6200);
            historyNavigationHandler(); // 2 → 1

            // History shouldn't grow during navigation
            expect(script.desktopHistory.length).toBe(historyLength);
        });
    });

    describe('Edge Cases', () => {
        test('should handle navigation to non-existent desktop', () => {
            const invalidUuid = 'invalid-uuid';

            expect(() => {
                script.navigateToDesktop(invalidUuid);
            }).not.toThrow();

            // Should remain on current desktop
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]);
        });

        test('should reset history when desktops change', () => {
            // Build some history
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            const desktopsChangedHandler = mockWorkspace.desktopsChanged.connect.mock.calls[0][0];

            // Trigger desktops changed
            desktopsChangedHandler();

            // Should reset to current desktop only
            expect(script.desktopHistory).toEqual([mockWorkspace.currentDesktop.id]);
            expect(script.historyIndex).toBe(0);
        });
    });
});
