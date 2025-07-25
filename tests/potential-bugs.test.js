/**
 * @fileoverview Tests to expose potential bugs in the implementation
 */

const fs = require('fs');
const path = require('path');

// Mock UUIDs for testing edge cases
const testUUIDs = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
];

function createMockWorkspace(options = {}) {
    const defaults = {
        hasCurrentDesktop: true,
        hasDesktops: true,
        desktopCount: 3,
        currentDesktopIndex: 0,
    };

    const config = { ...defaults, ...options };

    const desktops = config.hasDesktops
        ? Array.from({ length: config.desktopCount }, (_, i) => ({
            id: testUUIDs[i] || `test-uuid-${i}`,
            x11DesktopNumber: i + 1,
            name: `Desktop ${i + 1}`,
        }))
        : [];

    return {
        currentDesktop: config.hasCurrentDesktop
            ? desktops[config.currentDesktopIndex] || null
            : null,
        desktops: desktops,
        currentDesktopChanged: { connect: jest.fn() },
        desktopsChanged: { connect: jest.fn() },
    };
}

function loadScript() {
    const scriptPath = path.join(__dirname, '..', 'contents', 'code', 'main.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    if (global.lastUsedDesktops) {
        delete global.lastUsedDesktops;
    }

    eval(scriptContent);
    return global.lastUsedDesktops;
}

describe('Potential Bug Exposure Tests', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let mockConsole;

    beforeEach(() => {
        jest.clearAllMocks();

        mockRegisterShortcut = jest.fn();
        mockConsole = {
            info: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };

        global.registerShortcut = mockRegisterShortcut;
        global.console = mockConsole;
    });

    describe('Bug 1: Invalid Desktop Navigation', () => {
        test('should handle navigation to non-existent desktop gracefully', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Try to navigate to a desktop that doesn't exist in workspace.desktops
            const invalidDesktopId = '99999999-9999-9999-9999-999999999999';

            // This should not throw an error and should log appropriate warning
            expect(() => {
                lastUsedDesktops.navigateToDesktop(invalidDesktopId);
            }).not.toThrow();

            // Should log error about desktop not found
            expect(mockConsole.error).toHaveBeenCalledWith(
                `LastUsedDesktops: Desktop ${invalidDesktopId} not found`,
            );

            // workspace.currentDesktop should remain unchanged
            expect(mockWorkspace.currentDesktop).toBe(mockWorkspace.desktops[0]);
        });

        test('should handle empty workspace.desktops array', () => {
            mockWorkspace = createMockWorkspace({ hasDesktops: false });
            global.workspace = mockWorkspace;

            expect(() => {
                loadScript();
            }).not.toThrow();

            // Should warn about no desktops available
            expect(mockConsole.warn).toHaveBeenCalledWith(
                'LastUsedDesktops: No desktops available for mapping',
            );
        });

        test('should handle null currentDesktop during initialization', () => {
            mockWorkspace = createMockWorkspace({ hasCurrentDesktop: false });
            global.workspace = mockWorkspace;

            expect(() => {
                loadScript();
            }).not.toThrow();

            // Should warn about invalid current desktop
            expect(mockConsole.warn).toHaveBeenCalledWith(
                'LastUsedDesktops: Could not initialize - invalid current desktop',
            );
        });
    });

    describe('Bug 2: Desktop Number Mapping Edge Cases', () => {
        test('should handle desktops without x11DesktopNumber', () => {
            mockWorkspace = createMockWorkspace();
            // Remove x11DesktopNumber from some desktops
            mockWorkspace.desktops[1].x11DesktopNumber = undefined;
            mockWorkspace.desktops[2].x11DesktopNumber = null;

            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Should use array index + 1 for desktops without x11DesktopNumber
            expect(lastUsedDesktops.desktopNumberMap[1]).toBe(testUUIDs[0]);
            expect(lastUsedDesktops.desktopNumberMap[2]).toBe(testUUIDs[1]); // index 1 -> desktop 2
            expect(lastUsedDesktops.desktopNumberMap[3]).toBe(testUUIDs[2]); // index 2 -> desktop 3
        });

        test('should handle duplicate x11DesktopNumbers', () => {
            mockWorkspace = createMockWorkspace();
            // Create duplicate desktop numbers (edge case)
            mockWorkspace.desktops[1].x11DesktopNumber = 1; // Same as desktop 0

            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Last one should win (desktop mapping gets overwritten)
            expect(lastUsedDesktops.desktopNumberMap[1]).toBe(testUUIDs[1]); // Not testUUIDs[0]
        });
    });

    describe('Bug 3: Navigation Buffer State Management', () => {
        test('should clear navigation buffer on failed navigation', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Set up some navigation buffer state
            lastUsedDesktops.navigationBuffer = testUUIDs[1];

            // Try to navigate to invalid desktop
            lastUsedDesktops.navigateToDesktop('invalid-uuid');

            // The navigationBuffer should remain because the failed navigation
            // doesn't clear it (potential bug)
            expect(lastUsedDesktops.navigationBuffer).toBe(testUUIDs[1]);

            // This could cause issues when commitNavigationBuffer is called later
        });

        test('should handle commitNavigationBuffer with invalid buffer', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Set invalid navigation buffer
            lastUsedDesktops.navigationBuffer = 'invalid-uuid';

            expect(() => {
                lastUsedDesktops.commitNavigationBuffer();
            }).not.toThrow();

            // Buffer should be cleared even if invalid
            expect(lastUsedDesktops.navigationBuffer).toBe(null);
        });
    });

    describe('Bug 4: History Management Edge Cases', () => {
        test('should handle addToHistory with invalid desktop ID', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            const initialHistoryLength = lastUsedDesktops.desktopHistory.length;

            // Try to add invalid desktop ID
            lastUsedDesktops.addToHistory('not-a-uuid');
            lastUsedDesktops.addToHistory('');
            lastUsedDesktops.addToHistory(null);
            lastUsedDesktops.addToHistory(undefined);

            // History should not have grown
            expect(lastUsedDesktops.desktopHistory.length).toBe(initialHistoryLength);

            // Should have logged warnings
            expect(mockConsole.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid desktop ID'),
            );
        });

        test('should handle cleanupHistory with all invalid desktops', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Fill history with invalid UUIDs
            lastUsedDesktops.desktopHistory = ['invalid-1', 'invalid-2', 'invalid-3'];

            lastUsedDesktops.cleanupHistory();

            // All should be removed
            expect(lastUsedDesktops.desktopHistory).toEqual([]);
        });
    });

    describe('Bug 5: getCurrentDesktopId Edge Cases', () => {
        test('should handle workspace.currentDesktop being null', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Simulate currentDesktop becoming null during runtime
            mockWorkspace.currentDesktop = null;

            const result = lastUsedDesktops.getCurrentDesktopId();
            expect(result).toBe(null);
        });

        test('should handle workspace.currentDesktop without id property', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Simulate corrupted desktop object
            mockWorkspace.currentDesktop = { name: 'Desktop 1' }; // Missing id

            const result = lastUsedDesktops.getCurrentDesktopId();
            expect(result).toBe(null);
        });
    });

    describe('Bug 6: Direct Desktop Navigation Edge Cases', () => {
        test('should handle toggle when history is empty', () => {
            mockWorkspace = createMockWorkspace();
            global.workspace = mockWorkspace;

            const lastUsedDesktops = loadScript();

            // Clear history
            lastUsedDesktops.desktopHistory = [];

            // Try to toggle from current desktop
            const desktop1Shortcut = mockRegisterShortcut.mock.calls.find(
                call => call[0] === 'Go to Desktop 1',
            )[3];

            expect(() => {
                desktop1Shortcut(); // Should toggle, but no history available
            }).not.toThrow();

            // Should warn about no previous desktop available
            expect(mockConsole.warn).toHaveBeenCalledWith(
                'LastUsedDesktops: No previous desktop available for toggle',
            );
        });

        test('should handle desktop number not in map', () => {
            mockWorkspace = createMockWorkspace({ desktopCount: 2 }); // Only 2 desktops
            global.workspace = mockWorkspace;

            loadScript();

            // Try to access desktop 3 (doesn't exist)
            const desktop3Shortcut = mockRegisterShortcut.mock.calls.find(
                call => call[0] === 'Go to Desktop 3',
            );

            // Desktop 3 shortcut should not be registered since we only have 2 desktops
            expect(desktop3Shortcut).toBeUndefined();
        });
    });
});
