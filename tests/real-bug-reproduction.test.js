/**
 * @fileoverview Exact reproduction of the real toggle bug from user logs
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
    '620a61d6-f71d-48b4-9ab5-2d31518be1db', // Desktop 11
    '1850acb8-6cde-4325-932d-41cbdce59ba9', // Desktop 12
    '3c3ff016-48a8-4b49-8a45-cc0c2b5fb9c2', // Desktop 13
    '58d0021d-8e6e-4bd6-88de-c2b5615fd864', // Desktop 14
    '4d0167eb-df4d-492b-85a7-be3c00dcc576', // Desktop 15
    'c6e51aaa-cfcf-4473-a3c6-e0f5b9192c04', // Desktop 16
    '466a9e33-44f3-469e-959c-d0f66a7a2743', // Desktop 17
    'f0616539-9354-44f2-865c-c889fbab4743', // Desktop 18
    'f505036d-6661-4e40-94be-603c00b5a978', // Desktop 19
    '01f52b4c-bbd9-4ac8-ac7b-bd840def34be', // Desktop 20
    'd03f7fba-47ea-4179-8586-a962d9915941', // Desktop 21
    '5db52cc2-0c48-4083-b551-c3b1f0cb65ae', // Desktop 22
    'dbaa48b2-9f00-410d-afbd-d2891387fb09', // Desktop 23
    'bd95af55-eb5a-4fc8-99e9-ddb6b56af421', // Desktop 24
];

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

describe('Real Toggle Bug - Exact Reproduction', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let lastUsedDesktops;
    let desktopChangeHandler;

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

        lastUsedDesktops = loadScript();
        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
    });

    test('exact reproduction from user logs', () => {
        // Initial state: Desktop 7 (matches log: d867ac67-46e2-4ac4-93df-ab92caf4aec0)
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);
        console.log('Initial desktop 7:', mockWorkspace.currentDesktop.id);
        console.log('Initial history:', lastUsedDesktops.desktopHistory);

        // User action: 7→8→9→10 (matches logs)
        // 7→8
        mockWorkspace.currentDesktop = { id: userUUIDs[7] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        console.log('After 7→8, history:', lastUsedDesktops.desktopHistory);

        // 8→9
        mockWorkspace.currentDesktop = { id: userUUIDs[8] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        console.log('After 8→9, history:', lastUsedDesktops.desktopHistory);

        // 9→10
        mockWorkspace.currentDesktop = { id: userUUIDs[9] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        console.log('After 9→10, history:', lastUsedDesktops.desktopHistory);

        // CRITICAL: User says they went 10→7, but NO LOG for this!
        // Let's test what happens if this transition is missing:
        console.log('\\n=== BUG SCENARIO: Missing 10→7 transition ===');
        console.log('Current history (missing 7 at end):', lastUsedDesktops.desktopHistory);

        // User toggle to Desktop 24
        const desktop24Shortcut = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Go to Desktop 24',
        )[3];

        // First toggle: should go to Desktop 24
        desktop24Shortcut();
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]); // Desktop 24
        console.log('After toggle to 24, current:', mockWorkspace.currentDesktop.id);

        // Simulate KWin setting current desktop (but don't trigger change handler yet)
        // This is key - the toggle happens, but the desktop change event might come later

        // Second toggle: BUG - should go back to 7, but will go to 10
        desktop24Shortcut();

        console.log('\\n=== BUG RESULT ===');
        console.log('After toggle back, current:', mockWorkspace.currentDesktop.id);
        console.log('Expected Desktop 7:', userUUIDs[6]);
        console.log('Actual Desktop 10:', userUUIDs[9]);

        // This confirms the bug: goes to Desktop 10 instead of Desktop 7
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[9]); // Desktop 10 (BUG)

        console.log('\\n=== ANALYSIS ===');
        console.log('History at time of toggle:', lastUsedDesktops.desktopHistory);
        console.log('Algorithm looks for most recent != 24');
        console.log('Finds:', userUUIDs[9], '(Desktop 10)');
        console.log('Missing Desktop 7 because 10→7 transition was not recorded');
    });

    test('what should happen with proper 10→7 transition', () => {
        // Same setup
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]);

        // Navigate 7→8→9→10
        mockWorkspace.currentDesktop = { id: userUUIDs[7] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        mockWorkspace.currentDesktop = { id: userUUIDs[8] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        mockWorkspace.currentDesktop = { id: userUUIDs[9] };
        desktopChangeHandler(mockWorkspace.currentDesktop);

        // PROPERLY record 10→7 transition
        mockWorkspace.currentDesktop = { id: userUUIDs[6] };
        desktopChangeHandler(mockWorkspace.currentDesktop);

        console.log('\\n=== CORRECT SCENARIO: With 10→7 transition ===');
        console.log('History with proper 10→7:', lastUsedDesktops.desktopHistory);

        const desktop24Shortcut = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Go to Desktop 24',
        )[3];

        desktop24Shortcut(); // 7→24
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[23]);

        desktop24Shortcut(); // 24→7 (correct)

        console.log('After toggle back (correct), current:', mockWorkspace.currentDesktop.id);
        console.log('Should be Desktop 7:', userUUIDs[6]);

        // This should work correctly
        expect(mockWorkspace.currentDesktop.id).toBe(userUUIDs[6]); // Desktop 7 (CORRECT)
    });

    test('investigate why 10→7 transition might be missing', () => {
        // This test examines possible reasons why the transition wasn't recorded

        console.log('\\n=== INVESTIGATING MISSING TRANSITION ===');

        // Setup same as user
        mockWorkspace.currentDesktop = { id: userUUIDs[7] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        mockWorkspace.currentDesktop = { id: userUUIDs[8] };
        desktopChangeHandler(mockWorkspace.currentDesktop);
        mockWorkspace.currentDesktop = { id: userUUIDs[9] };
        desktopChangeHandler(mockWorkspace.currentDesktop);

        console.log('History after 7→8→9→10:', lastUsedDesktops.desktopHistory);

        // Possible scenario 1: User manually switched to Desktop 7 via mouse/panel
        // This might not trigger the currentDesktopChanged signal in the same way

        // Possible scenario 2: addToHistory has a bug with Desktop 7 already being in history
        console.log(
            'Desktop 7 already in history at index:',
            lastUsedDesktops.desktopHistory.indexOf(userUUIDs[6]),
        );

        // Let's manually test addToHistory with Desktop 7
        console.log('Before manual addToHistory(7):', lastUsedDesktops.desktopHistory);
        lastUsedDesktops.addToHistory(userUUIDs[6]);
        console.log('After manual addToHistory(7):', lastUsedDesktops.desktopHistory);

        // This should show Desktop 7 moved to the end
        expect(lastUsedDesktops.desktopHistory[lastUsedDesktops.desktopHistory.length - 1]).toBe(
            userUUIDs[6],
        );
    });
});
