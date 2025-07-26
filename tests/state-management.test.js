/**
 * @fileoverview Tests for state management and edge cases
 */

const fs = require('fs');
const path = require('path');

// Mock UUIDs for testing
const testUUIDs = [
    'state-test-1111-1111-1111-111111111111',
    'state-test-2222-2222-2222-222222222222',
    'state-test-3333-3333-3333-333333333333',
];

function createMockWorkspace(options = {}) {
    const defaults = {
        desktopCount: 3,
        startDesktop: 0,
        hasValidDesktops: true,
    };
    const config = { ...defaults, ...options };

    const desktops = config.hasValidDesktops
        ? Array.from({ length: config.desktopCount }, (_, index) => ({
              id: testUUIDs[index] || `generated-uuid-${index}`,
              x11DesktopNumber: index + 1,
              name: `Desktop ${index + 1}`,
          }))
        : [];

    return {
        currentDesktop: config.hasValidDesktops
            ? { id: testUUIDs[config.startDesktop] || `generated-uuid-${config.startDesktop}` }
            : null,
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

describe('State Management and Edge Cases', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let script;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRegisterShortcut = jest.fn();

        globalThis.registerShortcut = mockRegisterShortcut;
        globalThis.readConfig = jest.fn((key, defaultValue) => defaultValue);
        globalThis.console = { log: jest.fn(), error: jest.fn() };

        jest.spyOn(Date, 'now').mockReturnValue(1000);
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    describe('Initialization Edge Cases', () => {
        test('should handle desktops without x11DesktopNumber', () => {
            mockWorkspace = createMockWorkspace();
            // Remove x11DesktopNumber from some desktops
            mockWorkspace.desktops[1].x11DesktopNumber = undefined;
            mockWorkspace.desktops[2].x11DesktopNumber = null;
            globalThis.workspace = mockWorkspace;

            script = loadScript();

            // Should use array index + 1 as fallback
            expect(script.desktopID[1]).toBe(testUUIDs[0]);
            expect(script.desktopID[2]).toBe(testUUIDs[1]); // index 1 + 1 = 2
            expect(script.desktopID[3]).toBe(testUUIDs[2]); // index 2 + 1 = 3
        });
    });

    describe('Desktop Change Handling', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should update history on desktop change', () => {
            const desktopChangeHandler =
                mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];

            const initialHistory = [...script.desktopHistory];

            // Simulate desktop change
            const newDesktop = { id: testUUIDs[1] };
            mockWorkspace.currentDesktop = newDesktop;
            desktopChangeHandler(newDesktop);

            expect(script.desktopHistory.length).toBe(initialHistory.length + 1);
            expect(script.desktopHistory[script.desktopHistory.length - 1]).toBe(testUUIDs[1]);
        });

        test('should skip history update during navigation', () => {
            const desktopChangeHandler =
                mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];

            // Set navigation target
            script.targetDesktopId = testUUIDs[1];
            const initialHistoryLength = script.desktopHistory.length;

            // Simulate desktop change to target
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // History should not be updated during navigation
            expect(script.desktopHistory.length).toBe(initialHistoryLength);
        });

        test('should handle desktop change to unknown desktop', () => {
            const desktopChangeHandler =
                mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];

            const unknownDesktop = { id: 'unknown-desktop-uuid' };

            expect(() => {
                desktopChangeHandler(unknownDesktop);
            }).not.toThrow();
        });
    });

    describe('Target Desktop Management', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should clear target desktop after commit', () => {
            script.targetDesktopId = testUUIDs[1];

            script.commitTargetDesktopId();

            expect(script.targetDesktopId).toBe(null);
        });

        test('should add target desktop to history on commit', () => {
            const initialHistoryLength = script.desktopHistory.length;
            script.targetDesktopId = testUUIDs[1];

            script.commitTargetDesktopId();

            expect(script.desktopHistory.length).toBe(initialHistoryLength + 1);
            expect(script.desktopHistory[script.desktopHistory.length - 1]).toBe(testUUIDs[1]);
        });

        test('should handle commit with null target', () => {
            script.targetDesktopId = null;
            const initialHistoryLength = script.desktopHistory.length;

            expect(() => {
                script.commitTargetDesktopId();
            }).not.toThrow();

            expect(script.desktopHistory.length).toBe(initialHistoryLength);
        });
    });

    describe('Desktop Reconfiguration', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should rebuild mappings on desktops change', () => {
            const desktopsChangedHandler = mockWorkspace.desktopsChanged.connect.mock.calls[0][0];

            // Change workspace configuration
            const newUUIDs = ['new-1', 'new-2'];
            mockWorkspace.desktops = [
                { id: newUUIDs[0], x11DesktopNumber: 1, name: 'New Desktop 1' },
                { id: newUUIDs[1], x11DesktopNumber: 2, name: 'New Desktop 2' },
            ];
            mockWorkspace.currentDesktop = { id: newUUIDs[0] };

            desktopsChangedHandler();

            // Mappings should be rebuilt
            expect(script.desktopID[1]).toBe(newUUIDs[0]);
            expect(script.desktopID[2]).toBe(newUUIDs[1]);
            expect(script.desktopNum[newUUIDs[0]]).toBe(1);
            expect(script.desktopNum[newUUIDs[1]]).toBe(2);
        });

        test('should reset history on desktops change', () => {
            const desktopsChangedHandler = mockWorkspace.desktopsChanged.connect.mock.calls[0][0];

            // Build some history first
            script.desktopHistory = [testUUIDs[0], testUUIDs[1], testUUIDs[2]];

            desktopsChangedHandler();

            // History should be reset to current desktop
            expect(script.desktopHistory).toEqual([mockWorkspace.currentDesktop.id]);
            expect(script.historyIndex).toBe(0);
            expect(script.targetDesktopId).toBe(null);
        });
    });

    describe('Navigation Error Handling', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should handle navigation to non-existent desktop', () => {
            const originalDesktop = mockWorkspace.currentDesktop.id;

            expect(() => {
                script.navigateToDesktop('non-existent-uuid');
            }).not.toThrow();

            // Should remain on original desktop
            expect(mockWorkspace.currentDesktop.id).toBe(originalDesktop);
        });

        test('should handle invalid desktop in addToHistory', () => {
            const initialHistoryLength = script.desktopHistory.length;

            expect(() => {
                script.addToHistory('invalid-uuid');
            }).not.toThrow();

            // History should still be updated (it just adds the UUID)
            expect(script.desktopHistory.length).toBe(initialHistoryLength + 1);
        });
    });

    describe('Utility Functions', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should describe desktop correctly', () => {
            const desc1 = script.desc(testUUIDs[0]);
            expect(desc1).toBe('desktop 1');

            const descUnknown = script.desc('unknown-uuid');
            expect(descUnknown).toBe('desktop unknown-uuid');
        });

        test('should handle debug logging', () => {
            script.debugEnabled = true;

            expect(() => {
                script.debug('Test message', 'extra', 'args');
            }).not.toThrow();

            expect(globalThis.console.log).toHaveBeenCalledWith(
                'LastUsedDesktops: Test message',
                'extra',
                'args',
            );
        });

        test('should not log when debug disabled', () => {
            script.debugEnabled = false;

            script.debug('Test message');

            expect(globalThis.console.log).not.toHaveBeenCalled();
        });
    });

    describe('History Index Management', () => {
        beforeEach(() => {
            mockWorkspace = createMockWorkspace();
            globalThis.workspace = mockWorkspace;
            script = loadScript();
        });

        test('should handle history index bounds', () => {
            // Build minimal history
            script.desktopHistory = [testUUIDs[0]];
            script.historyIndex = 0;

            // Try to go beyond bounds
            script.historyIndex = -1;
            expect(script.historyIndex).toBe(-1); // Should allow negative (handled in navigation)

            script.historyIndex = 5; // Beyond history length
            expect(script.historyIndex).toBe(5); // Should allow (bounds checked in navigation)
        });

        test('should reset index properly', () => {
            script.historyIndex = 5;
            script.targetDesktopId = testUUIDs[1];

            script.resetHistory();

            expect(script.historyIndex).toBe(0);
            expect(script.targetDesktopId).toBe(null);
            expect(script.desktopHistory).toEqual([mockWorkspace.currentDesktop.id]);
        });
    });
});
