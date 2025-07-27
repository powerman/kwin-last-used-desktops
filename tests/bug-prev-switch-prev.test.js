/**
 * @fileoverview Bug demonstration: Prev→Switch→Prev and Prev→Toggle→Prev history navigation sequences
 */

const fs = require('fs');
const path = require('path');

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

describe('Bug demonstration for history navigation', () => {
    let mockWorkspace;
    let mockRegisterShortcut;
    let desktopChangeHandler;
    let historyNavigationHandler;
    let toggleHandler2;
    let toggleHandler4;

    beforeEach(() => {
        jest.clearAllMocks();
        mockWorkspace = createMockWorkspace(0);
        mockRegisterShortcut = jest.fn();
        globalThis.workspace = mockWorkspace;
        globalThis.registerShortcut = mockRegisterShortcut;
        globalThis.readConfig = jest.fn((key, defaultValue) => defaultValue);
        globalThis.console = { log: jest.fn(), error: jest.fn() };
        jest.spyOn(Date, 'now').mockReturnValue(1000);
        loadScript();
        desktopChangeHandler = mockWorkspace.currentDesktopChanged.connect.mock.calls[0][0];
        historyNavigationHandler = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Last Used Virtual Desktops',
        )[3];
        // Find toggle handler for Desktop 2
        toggleHandler2 = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Go to Desktop 2',
        )[3];
        toggleHandler4 = mockRegisterShortcut.mock.calls.find(
            call => call[0] === 'Go to Desktop 4',
        )[3];
    });

    afterEach(() => {
        Date.now.mockRestore();
    });

    test('Prev→Switch→Prev: should end up on Desktop 4', () => {
        // Build history: 1 → 2 → 3 → 4 → 5
        for (let i = 1; i < 5; i++) {
            mockWorkspace.currentDesktop = { id: testUUIDs[i] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
        }
        // Now on Desktop 5, history: [1, 2, 3, 4, 5]
        // First Prev (onPrevUsedDesktop): start history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(7000);
        historyNavigationHandler(); // 5 → 4
        desktopChangeHandler(mockWorkspace.currentDesktop);
        // "Switch" — standard KWin desktop switch (onCurrentDesktopChanged), go to Desktop 2
        mockWorkspace.currentDesktop = { id: testUUIDs[1] };
        desktopChangeHandler(mockWorkspace.currentDesktop); // 4 → 2
        // Second Prev (onPrevUsedDesktop): continue history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(7200);
        historyNavigationHandler();
        desktopChangeHandler(mockWorkspace.currentDesktop);
        // Expect to be on Desktop 4
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4
    });

    test('Prev→Toggle→Prev (toggle switches): should end up on Desktop 4', () => {
        // Build history: 1 → 2 → 3 → 4 → 5
        for (let i = 1; i < 5; i++) {
            mockWorkspace.currentDesktop = { id: testUUIDs[i] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
        }
        // Now on Desktop 5, history: [1, 2, 3, 4, 5]
        // First Prev (onPrevUsedDesktop): start history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(8000);
        historyNavigationHandler(); // 5 → 4
        desktopChangeHandler(mockWorkspace.currentDesktop);
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4
        // Toggle to Desktop 2 (onToggleDesktop, switches to Desktop 2)
        toggleHandler2(); // Should switch to Desktop 2
        desktopChangeHandler(mockWorkspace.currentDesktop);
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[1]); // Desktop 2
        // Second Prev (onPrevUsedDesktop): continue history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(8200);
        historyNavigationHandler();
        desktopChangeHandler(mockWorkspace.currentDesktop);
        // Expect to be on Desktop 4
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4
    });

    test('Prev→ToggleBack→Prev (toggle triggers previous): should end up on Desktop 4', () => {
        // Build history: 1 → 2 → 3 → 4 → 5
        for (let i = 1; i < 5; i++) {
            mockWorkspace.currentDesktop = { id: testUUIDs[i] };
            desktopChangeHandler(mockWorkspace.currentDesktop);
        }
        // Now on Desktop 5, history: [1, 2, 3, 4, 5]
        // First Prev (onPrevUsedDesktop): start history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(9000);
        historyNavigationHandler(); // 5 → 4
        desktopChangeHandler(mockWorkspace.currentDesktop);
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4
        // Toggle to Desktop 4 again (already on Desktop 4, triggers previous used desktop)
        // Find toggle handler for Desktop 4
        toggleHandler4(); // Should trigger previous used desktop (onPrevUsedDesktop)
        desktopChangeHandler(mockWorkspace.currentDesktop);
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[4]); // Desktop 5
        // Second Prev (onPrevUsedDesktop): continue history navigation (should go to Desktop 4)
        Date.now.mockReturnValue(9200);
        historyNavigationHandler();
        desktopChangeHandler(mockWorkspace.currentDesktop);
        // Expect to be on Desktop 4
        expect(mockWorkspace.currentDesktop.id).toBe(testUUIDs[3]); // Desktop 4
    });
});
