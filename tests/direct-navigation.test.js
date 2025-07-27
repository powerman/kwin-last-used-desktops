/**
 * @fileoverview Tests for direct desktop navigation with toggle functionality
 */

const fs = require('fs');
const path = require('path');

// Mock UUIDs for testing
const testUUIDs = [
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Desktop 1
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // Desktop 2
    'cccccccc-cccc-cccc-cccc-cccccccccccc', // Desktop 3
    'dddddddd-dddd-dddd-dddd-dddddddddddd', // Desktop 4
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', // Desktop 5
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

describe('Direct Desktop Navigation', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let script;
    let desktopChangeHandler;
    let historyNavigationHandler;
    let desktopShortcuts = {};

    beforeEach(() => {
        jest.clearAllMocks();

        mockWorkspace = createMockWorkspace(0);
        mockRegisterShortcut = jest.fn();

        globalThis.workspace = mockWorkspace;
        globalThis.registerShortcut = mockRegisterShortcut;
        globalThis.readConfig = jest.fn((key, defaultValue) => defaultValue);
        globalThis.console = { log: jest.fn(), error: jest.fn() };

        // Mock Date.now for testing
        jest.spyOn(Date, 'now').mockReturnValue(1000);

        script = loadScript();

        // Get event handlers
        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
        historyNavigationHandler = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Last Used Virtual Desktops',
        )[3];

        // Collect desktop shortcuts
        desktopShortcuts = {};
        mockRegisterShortcut.mock.calls.forEach(call => {
            const match = call[0].match(/^Go to Desktop (\d+)$/);
            if (match) {
                const desktopNum = parseInt(match[1]);
                desktopShortcuts[desktopNum] = call[3];
            }
        });
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    describe('Basic Direct Navigation', () => {
        test('should navigate directly to specified desktop', () => {
            // Currently on Desktop 1, navigate to Desktop 3
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]);

            desktopShortcuts[3]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[2]); // Desktop 3
        });

        test('should handle navigation to non-existent desktop', () => {
            const currentDesktop = mockWorkspace.currentDesktop.id;

            // Try to navigate to desktop that doesn't exist
            desktopShortcuts[10](); // Only 5 desktops exist

            // Should remain on current desktop
            expect(mockWorkspace.currentDesktop.id).toBe(currentDesktop);
        });

        test('should register shortcuts for all desktops up to max', () => {
            // Should register shortcuts for desktops 1-20 (default max)
            for (let i = 1; i <= 20; i++) {
                expect(desktopShortcuts[i]).toBeDefined();
            }
        });
    });

    describe('Toggle Functionality', () => {
        test('should toggle between two desktops', () => {
            // Start on Desktop 1, build some history
            mockWorkspace.currentDesktop = { id: testUUIDs[1] }; // Go to Desktop 2
            desktopChangeHandler(mockWorkspace.currentDesktop);
            mockWorkspace.currentDesktop = { id: testUUIDs[2] }; // Go to Desktop 3
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Currently on Desktop 3, try to go to Desktop 3 (should toggle)
            desktopShortcuts[3]();

            // Should go to previous desktop (Desktop 2)
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2
        });

        test('should handle toggle when on target desktop', () => {
            // Build history: 1 → 2 → 1
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            mockWorkspace.currentDesktop = { id: testUUIDs[0] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Currently on Desktop 1, press Desktop 1 shortcut (should toggle)
            desktopShortcuts[1]();

            // Should go to previous desktop (Desktop 2)
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2
        });

        test('should handle multiple rapid toggles', () => {
            // Build initial history: 1 → 2
            mockWorkspace.currentDesktop = { id: testUUIDs[1] };
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Toggle Desktop 2: 2 → 1
            desktopShortcuts[2]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]); // Desktop 1
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Toggle Desktop 2 again: 1 → 2
            desktopShortcuts[2]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // Toggle Desktop 2 once more: 2 → 1
            desktopShortcuts[2]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[0]); // Desktop 1
        });
    });

    describe('Integration with History Navigation', () => {
        test('should not interfere with history navigation timing', () => {
            // Build history: 1 → 2 → 3
            [testUUIDs[1], testUUIDs[2]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // Use direct navigation to Desktop 4
            desktopShortcuts[4]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4

            // Simulate the desktop change event
            desktopChangeHandler(mockWorkspace.currentDesktop);

            // History navigation should work from current position
            // Current history after going to Desktop 4: [1, 2, 3, 4]
            // So previous should be Desktop 3
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[2]); // Desktop 3 (previous)
        });

        test('should properly integrate toggle with history navigation', () => {
            // Build history: 1 → 2 → 3
            [testUUIDs[1], testUUIDs[2]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // Toggle Desktop 3 (currently on Desktop 3)
            desktopShortcuts[3]();
            expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2

            // The toggle should have used history navigation internally
            // which sets lastPrevUsedShortcutTime to current time,
            // but then it should reset it to 0 because toggle should not start continuing.
            expect(script.lastPrevUsedShortcutTime).toBe(0);
        });
    });

    describe('Desktop Mapping', () => {
        test('should correctly map desktop numbers to UUIDs', () => {
            expect(script.desktopID[1]).toBe(testUUIDs[0]);
            expect(script.desktopID[2]).toBe(testUUIDs[1]);
            expect(script.desktopID[3]).toBe(testUUIDs[2]);
            expect(script.desktopID[4]).toBe(testUUIDs[3]);
            expect(script.desktopID[5]).toBe(testUUIDs[4]);
        });

        test('should correctly map UUIDs to desktop numbers', () => {
            expect(script.desktopNum[testUUIDs[0]]).toBe(1);
            expect(script.desktopNum[testUUIDs[1]]).toBe(2);
            expect(script.desktopNum[testUUIDs[2]]).toBe(3);
            expect(script.desktopNum[testUUIDs[3]]).toBe(4);
            expect(script.desktopNum[testUUIDs[4]]).toBe(5);
        });

        test('should rebuild mappings when desktops change', () => {
            const desktopsChangedHandler = mockWorkspace.desktopsChanged.connect.mock.calls[0][0];

            // Change desktop configuration
            mockWorkspace.desktops = [
                { id: 'new-uuid-1', x11DesktopNumber: 1, name: 'New Desktop 1' },
                { id: 'new-uuid-2', x11DesktopNumber: 2, name: 'New Desktop 2' },
            ];
            mockWorkspace.currentDesktop = { id: 'new-uuid-1' };

            // Trigger desktops changed
            desktopsChangedHandler();

            // Mappings should be updated
            expect(script.desktopID[1]).toBe('new-uuid-1');
            expect(script.desktopID[2]).toBe('new-uuid-2');
            expect(script.desktopNum['new-uuid-1']).toBe(1);
            expect(script.desktopNum['new-uuid-2']).toBe(2);
        });
    });

    describe('Error Handling', () => {
        test('should handle missing desktop gracefully', () => {
            const originalDesktop = mockWorkspace.currentDesktop.id;

            // Try to navigate to non-existent desktop (desktop 6 doesn't exist)
            expect(() => {
                desktopShortcuts[6]();
            }).not.toThrow();

            // Should remain on original desktop
            expect(mockWorkspace.currentDesktop.id).toBe(originalDesktop);
        });

        test('should handle corrupted desktop mappings', () => {
            // Corrupt the mapping
            script.desktopID[3] = 'non-existent-uuid';

            const originalDesktop = mockWorkspace.currentDesktop.id;

            expect(() => {
                desktopShortcuts[3]();
            }).not.toThrow();

            // Should remain on original desktop since navigation failed
            expect(mockWorkspace.currentDesktop.id).toBe(originalDesktop);
        });
    });
});
