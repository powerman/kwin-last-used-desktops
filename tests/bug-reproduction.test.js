/**
 * @fileoverview Comprehensive test to reproduce specific bugs from user logs
 */

const fs = require('fs');
const path = require('path');

// Real UUIDs based on user logs
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
    // Generate realistic UUIDs for remaining desktops
    ...Array.from({ length: 14 }, (_, i) => {
        const desktop = i + 11;
        // Create valid UUID format
        return `${desktop.toString().padStart(8, '0')}-1234-5678-9abc-def012345678`;
    }),
];

// Add desktop 24 UUID from user logs
userUUIDs[23] = 'bd95af55-eb5a-4fc8-99e9-ddb6b56af421';

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
        currentDesktop: { id: userUUIDs[6] }, // Start on desktop 7
        desktops: desktops,
        currentDesktopChanged: {
            connect: jest.fn(),
        },
        desktopsChanged: {
            connect: jest.fn(),
        },
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

describe('Bug Reproduction Tests', () => {
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
            info: jest.fn(),
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        };

        // Mock Date.now for testing continuation logic
        jest.spyOn(Date, 'now').mockReturnValue(1000);

        lastUsedDesktops = loadScript();

        // Get handlers
        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
        historyNavigationHandler = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Last Used Virtual Desktops',
        )[3];
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    describe('Bug 1: History Navigation Sequence Issue', () => {
        test('reproduces the user\'s exact bug scenario', () => {
            // Simulate user's scenario: 7→8→9→10→7
            console.log('=== REPRODUCING BUG 1 ===');

            // Current: Desktop 7 (already initialized)
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);
            console.log('Initial desktop:', mockWorkspace.currentDesktop.id);
            console.log('Initial history:', lastUsedDesktops.desktopHistory);

            // Switch to Desktop 8
            mockWorkspace.currentDesktop = { id: userUUIDs[7] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            console.log('After switch to 8 - history:', lastUsedDesktops.desktopHistory);

            // Switch to Desktop 9
            mockWorkspace.currentDesktop = { id: userUUIDs[8] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            console.log('After switch to 9 - history:', lastUsedDesktops.desktopHistory);

            // Switch to Desktop 10
            mockWorkspace.currentDesktop = { id: userUUIDs[9] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            console.log('After switch to 10 - history:', lastUsedDesktops.desktopHistory);

            // Switch back to Desktop 7
            mockWorkspace.currentDesktop = { id: userUUIDs[6] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
            console.log('After switch back to 7 - history:', lastUsedDesktops.desktopHistory);

            // History should be: [8, 9, 10, 7] (in order of use)
            const expectedHistory = [userUUIDs[7], userUUIDs[8], userUUIDs[9], userUUIDs[6]];
            expect(lastUsedDesktops.desktopHistory).toEqual(expectedHistory);

            // Now simulate quick navigation
            console.log('\\n=== QUICK NAVIGATION TEST ===');

            // First press - should go to Desktop 10 (previous)
            Date.now.mockReturnValue(1000);
            historyNavigationHandler();
            console.log('After 1st press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 10:', userUUIDs[9]);
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[9]); // Desktop 10

            // Second press (within continuation delay) - should go to Desktop 9
            Date.now.mockReturnValue(1200);
            historyNavigationHandler();
            console.log('After 2nd press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 9:', userUUIDs[8]);
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[8]); // Desktop 9

            // Third press (within continuation delay) - should go to Desktop 8
            Date.now.mockReturnValue(1400);
            historyNavigationHandler();
            console.log('After 3rd press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 8:', userUUIDs[7]);

            // BUG: This should go to Desktop 8, not back to Desktop 10
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[7]); // Desktop 8, NOT Desktop 10
        });
    });

    describe('Bug 2: Toggle Desktop Navigation Issue', () => {
        test('reproduces toggle issue with desktop 24', () => {
            console.log('\\n=== REPRODUCING BUG 2 ===');

            // Start on Desktop 7
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);
            console.log('Starting desktop 7:', mockWorkspace.currentDesktop.id);

            // Get Desktop 24 shortcut
            const desktop24Shortcut = mockRegisterShortcut.mock.calls.find(
                call => call[0] === 'Go to Desktop 24',
            )[3];

            expect(desktop24Shortcut).toBeDefined();
            console.log('Desktop 24 UUID:', userUUIDs[23]);
            console.log('Desktop 24 in map:', lastUsedDesktops.desktopNumberMap[24]);

            // First press: Go to Desktop 24
            desktop24Shortcut();
            console.log('After 1st press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 24:', userUUIDs[23]);
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]); // Should be on Desktop 24

            // Add desktop 24 to history (simulate that desktop change was triggered)
            desktopChangeHandler({ id: userUUIDs[23] });
            console.log('History after reaching 24:', lastUsedDesktops.desktopHistory);

            // Second press: Should toggle back to Desktop 7
            desktop24Shortcut();
            console.log('After 2nd press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 7:', userUUIDs[6]);
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]); // Should be back to Desktop 7

            // Add desktop 7 to history (simulate desktop change)
            desktopChangeHandler({ id: userUUIDs[6] });
            console.log('History after returning to 7:', lastUsedDesktops.desktopHistory);

            // Third press: Should go back to Desktop 24, NOT Desktop 1
            desktop24Shortcut();
            console.log('After 3rd press - current:', mockWorkspace.currentDesktop.id);
            console.log('Expected Desktop 24:', userUUIDs[23]);
            console.log('NOT Desktop 1:', userUUIDs[0]);

            // BUG: This should go to Desktop 24, not Desktop 1
            expect(mockWorkspace.currentDesktop.id).not.toBe(userUUIDs[0]); // Should NOT be Desktop 1
            expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]); // Should be Desktop 24
        });
    });

    describe('Debug Desktop Mapping', () => {
        test('verify all desktops are mapped correctly', () => {
            console.log('\\n=== DESKTOP MAPPING DEBUG ===');
            console.log('Total desktops:', Object.keys(lastUsedDesktops.desktopNumberMap).length);

            for (let i = 1; i <= 24; i++) {
                const mappedUUID = lastUsedDesktops.desktopNumberMap[i];
                const expectedUUID = userUUIDs[i - 1];
                console.log(`Desktop ${i}: ${mappedUUID} (expected: ${expectedUUID})`);
                expect(mappedUUID).toBe(expectedUUID);
            }
        });
    });
});
