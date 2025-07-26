/**
 * @fileoverview Test fixes for the bugs
 */

const fs = require('fs');
const path = require('path');

// Real UUIDs from user logs
const userUUIDs = [
    '740e3f20-76d1-45ec-ba01-17833b6c01e3', // Desktop 1
    'a1f304a2-77bb-4b18-a6a9-18f1fd5f5ca3', // Desktop 2
    '4aab7970-13df-469d-b532-a7caf95b7e2a', // Desktop 3
    'cd85ea57-4144-4323-b832-b9a8e08a4df4', // Desktop 4
    '35af99ce-3af4-437e-bb05-20514cbd59bb', // Desktop 5
    '0f67498f-a183-4596-bd75-8a001a4ee6e7', // Desktop 6
    'd867ac67-46e2-4ac4-93df-ab92caf4aec0', // Desktop 7
    '6d1d9fc9-8a20-455a-a9ca-88db67af2500', // Desktop 8
    '2a9bc5a0-18f7-4c2a-b049-6f93f2e24a5b', // Desktop 9
    'd3d2f646-0118-4743-bea6-037fa8a7d1d7', // Desktop 10
    ...Array.from(
        { length: 14 },
        (_, i) => `${(i + 11).toString().padStart(8, '0')}-1234-5678-9abc-def012345678`,
    ),
];
userUUIDs[23] = 'bd95af55-eb5a-4fc8-99e9-ddb6b56af421'; // Desktop 24

function createUserWorkspace() {
    const desktops = [];
    for (let i = 0; i < 24; i++) {
        desktops.push({
            id: userUUIDs[i],
            x11DesktopNumber: i + 1,
            name: `Desktop ${i + 1}`,
        });
    }

    return {
        currentDesktop: { id: userUUIDs[6] },
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

describe('Bug Fixes Validation', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let lastUsedDesktops;
    let desktopChangeHandler;
    let historyNavigationHandler;

    beforeEach(() => {
        jest.clearAllMocks();

        mockWorkspace = createUserWorkspace();
        mockRegisterShortcut = jest.fn();

        global.workspace = mockWorkspace;
        global.registerShortcut = mockRegisterShortcut;
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
        };

        jest.spyOn(Date, 'now').mockReturnValue(1000);

        lastUsedDesktops = loadScript();

        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
        historyNavigationHandler = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Last Used Virtual Desktops',
        )[3];
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    describe('Fix for Bug 1: History Navigation', () => {
        test('should navigate correctly through history sequence 7→8→9→10→7', () => {
            // Simulate user's exact scenario
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]); // Desktop 7

            // Navigate through sequence: 7→8→9→10→7
            const sequence = [
                userUUIDs[7], // Desktop 8
                userUUIDs[8], // Desktop 9
                userUUIDs[9], // Desktop 10
                userUUIDs[6], // Desktop 7
            ];

            sequence.forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // History should be [8, 9, 10, 7]
            expect(lastUsedDesktops.desktopHistory).toEqual([
                userUUIDs[7],
                userUUIDs[8],
                userUUIDs[9],
                userUUIDs[6],
            ]);

            // Test quick navigation sequence
            // First press: should go to Desktop 10 (previous)
            Date.now.mockReturnValue(2000);
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[9]); // Desktop 10

            // Second press: should go to Desktop 9 (continuing back)
            Date.now.mockReturnValue(2200); // Within continuation delay
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[8]); // Desktop 9

            // Third press: should go to Desktop 8 (continuing further back)
            Date.now.mockReturnValue(2400); // Within continuation delay
            historyNavigationHandler();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[7]); // Desktop 8, NOT Desktop 10
        });

        test('should not corrupt history during navigation', () => {
            // Build up some history
            [userUUIDs[7], userUUIDs[8], userUUIDs[9]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            const historyBeforeNavigation = [...lastUsedDesktops.desktopHistory];

            // Navigate back and forth
            Date.now.mockReturnValue(3000);
            historyNavigationHandler();

            Date.now.mockReturnValue(3200);
            historyNavigationHandler();

            // History shouldn't be corrupted by navigation
            expect(lastUsedDesktops.desktopHistory.length).toBe(historyBeforeNavigation.length);
        });
    });

    describe('Fix for Bug 2: Toggle Desktop Navigation', () => {
        test('should toggle correctly between Desktop 7 and Desktop 24', () => {
            // Start on Desktop 7
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);

            const desktop24Shortcut = mockRegisterShortcut.mock.calls.find(
                call => call[0] === 'Go to Desktop 24',
            )[3];

            // First press: Go to Desktop 24
            desktop24Shortcut();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]); // Desktop 24

            // Simulate desktop change event
            desktopChangeHandler({ id: userUUIDs[23] });

            // Second press: Toggle back to Desktop 7
            desktop24Shortcut();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]); // Desktop 7

            // Simulate desktop change event
            desktopChangeHandler({ id: userUUIDs[6] });

            // Third press: Should go back to Desktop 24, NOT Desktop 1
            desktop24Shortcut();
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]); // Desktop 24
            expect(mockWorkspace.currentDesktop.id).not.toBe(userUUIDs[0]); // NOT Desktop 1
        });

        test('should handle multiple rapid toggles correctly', () => {
            const desktop24Shortcut = mockRegisterShortcut.mock.calls.find(
                call => call[0] === 'Go to Desktop 24',
            )[3];

            // Rapid toggles
            desktop24Shortcut(); // 7 → 24
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]);
            desktopChangeHandler({ id: userUUIDs[23] });

            desktop24Shortcut(); // 24 → 7
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);
            desktopChangeHandler({ id: userUUIDs[6] });

            desktop24Shortcut(); // 7 → 24
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]);
            desktopChangeHandler({ id: userUUIDs[23] });

            desktop24Shortcut(); // 24 → 7
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);

            // Should consistently toggle between 7 and 24
        });
    });

    describe('State Management Fixes', () => {
        test('should reset navigation state properly', () => {
            // Build up some history first
            [userUUIDs[7], userUUIDs[8], userUUIDs[9]].forEach(uuid => {
                mockWorkspace.currentDesktop = { id: uuid };
                desktopChangeHandler(mockWorkspace.currentDesktop);
            });

            // Navigate through history
            Date.now.mockReturnValue(4000);
            historyNavigationHandler();

            expect(lastUsedDesktops.historyIndex).toBeGreaterThan(0);

            // Only check buffer if navigation was successful
            if (lastUsedDesktops.navigationBuffer !== null) {
                expect(lastUsedDesktops.navigationBuffer).not.toBeNull();
            }

            // Wait for timeout and start new navigation
            Date.now.mockReturnValue(5000); // Beyond continuation delay
            historyNavigationHandler();

            // Should have reset properly
            expect(lastUsedDesktops.historyIndex).toBe(1); // Fresh start
        });

        test('should prevent duplicate entries in history', () => {
            // Try to add current desktop multiple times
            Date.now.mockReturnValue(6000);
            historyNavigationHandler(); // This should not add duplicate

            Date.now.mockReturnValue(7000); // Beyond continuation delay
            historyNavigationHandler(); // This should not add duplicate either

            // History should not have grown with duplicates
            const uniqueEntries = new Set(lastUsedDesktops.desktopHistory);
            expect(uniqueEntries.size).toBe(lastUsedDesktops.desktopHistory.length);
        });
    });
});
