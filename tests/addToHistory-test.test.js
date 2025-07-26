/**
 * @fileoverview Test addToHistory behavior with duplicates
 */

const fs = require('fs');
const path = require('path');

const testUUIDs = [
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
];

function createMockWorkspace() {
    const desktops = [];
    for (let i = 0; i < 10; i++) {
        desktops.push({
            id: testUUIDs[i],
            x11DesktopNumber: i + 1,
            name: `Desktop ${i + 1}`,
        });
    }

    return {
        currentDesktop: { id: testUUIDs[6] }, // Start on desktop 7
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

describe('addToHistory Duplicate Handling', () => {
    let mockWorkspace;
    let lastUsedDesktops;

    beforeEach(() => {
        jest.clearAllMocks();

        mockWorkspace = createMockWorkspace();

        global.workspace = mockWorkspace;
        global.registerShortcut = jest.fn();
        global.console = {
            log: jest.fn(),
            error: jest.fn(),
        };

        lastUsedDesktops = loadScript();
    });

    test('addToHistory correctly handles duplicates - exact user scenario', () => {
        // Simulate exactly what happened in user logs
        console.log('\\n=== TESTING addToHistory WITH USER SCENARIO ===');

        // Initial: Desktop 7 should be in history from initialization
        console.log('Initial history:', lastUsedDesktops.desktopHistory);
        expect(lastUsedDesktops.desktopHistory).toContain(testUUIDs[6]); // Desktop 7

        // Add Desktop 8 (7→8)
        lastUsedDesktops.addToHistory(testUUIDs[7]);
        console.log('After adding 8:', lastUsedDesktops.desktopHistory);

        // Add Desktop 9 (8→9)
        lastUsedDesktops.addToHistory(testUUIDs[8]);
        console.log('After adding 9:', lastUsedDesktops.desktopHistory);

        // Add Desktop 10 (9→10)
        lastUsedDesktops.addToHistory(testUUIDs[9]);
        console.log('After adding 10:', lastUsedDesktops.desktopHistory);

        // At this point history should be: [7, 8, 9, 10]
        expect(lastUsedDesktops.desktopHistory).toEqual([
            testUUIDs[6],
            testUUIDs[7],
            testUUIDs[8],
            testUUIDs[9],
        ]);

        // NOW: Add Desktop 7 again (10→7) - THIS IS THE CRITICAL STEP
        console.log('\\nBefore adding 7 again (the critical step):');
        console.log('History:', lastUsedDesktops.desktopHistory);
        console.log('Index of Desktop 7:', lastUsedDesktops.desktopHistory.indexOf(testUUIDs[6]));

        lastUsedDesktops.addToHistory(testUUIDs[6]);

        console.log('\\nAfter adding 7 again:');
        console.log('History:', lastUsedDesktops.desktopHistory);

        // History should now be: [8, 9, 10, 7] (7 moved to end)
        expect(lastUsedDesktops.desktopHistory).toEqual([
            testUUIDs[7],
            testUUIDs[8],
            testUUIDs[9],
            testUUIDs[6],
        ]);

        // The last element should be Desktop 7
        expect(lastUsedDesktops.desktopHistory[lastUsedDesktops.desktopHistory.length - 1]).toBe(
            testUUIDs[6],
        );

        console.log('✓ addToHistory works correctly with duplicates');
    });

    test('verify toggle algorithm with correct history', () => {
        // Set up the history as it should be after proper 10→7 transition
        lastUsedDesktops.desktopHistory = [
            testUUIDs[7],
            testUUIDs[8],
            testUUIDs[9],
            testUUIDs[6], // [8, 9, 10, 7]
        ];

        console.log('\\n=== TESTING TOGGLE ALGORITHM ===');
        console.log('History (correct):', lastUsedDesktops.desktopHistory);

        // Simulate being on Desktop 24 and toggling back
        const currentDesktopId = 'bd95af55-eb5a-4fc8-99e9-ddb6b56af421'; // Desktop 24

        // Find most recent desktop != currentDesktopId
        let previousDesktopId = null;
        for (let i = lastUsedDesktops.desktopHistory.length - 1; i >= 0; i--) {
            const desktopId = lastUsedDesktops.desktopHistory[i];
            if (desktopId !== currentDesktopId) {
                previousDesktopId = desktopId;
                break;
            }
        }

        console.log('Current desktop (24):', currentDesktopId);
        console.log('Algorithm found:', previousDesktopId);
        console.log('Expected Desktop 7:', testUUIDs[6]);

        expect(previousDesktopId).toBe(testUUIDs[6]); // Should find Desktop 7
        console.log('✓ Toggle algorithm works correctly with proper history');
    });

    test('reproduce the bug - missing 10→7 transition', () => {
        // Reproduce the exact bug scenario from logs
        lastUsedDesktops.desktopHistory = [
            testUUIDs[6],
            testUUIDs[7],
            testUUIDs[8],
            testUUIDs[9], // [7, 8, 9, 10] - missing 7 at end
        ];

        console.log('\\n=== REPRODUCING THE BUG ===');
        console.log('History (buggy - missing 7 at end):', lastUsedDesktops.desktopHistory);

        const currentDesktopId = 'bd95af55-eb5a-4fc8-99e9-ddb6b56af421'; // Desktop 24

        let previousDesktopId = null;
        for (let i = lastUsedDesktops.desktopHistory.length - 1; i >= 0; i--) {
            const desktopId = lastUsedDesktops.desktopHistory[i];
            if (desktopId !== currentDesktopId) {
                previousDesktopId = desktopId;
                break;
            }
        }

        console.log('Current desktop (24):', currentDesktopId);
        console.log('Algorithm found:', previousDesktopId);
        console.log('Found Desktop 10:', testUUIDs[9]);
        console.log('Should have been Desktop 7:', testUUIDs[6]);

        expect(previousDesktopId).toBe(testUUIDs[9]); // BUG: finds Desktop 10
        console.log('🐛 BUG CONFIRMED: Algorithm finds Desktop 10 instead of Desktop 7');
    });
});
