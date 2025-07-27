/**
 * @fileoverview Basic integration tests for LastUsedDesktops class
 */

// Mock UUIDs for testing
const mockUUIDs = [
    '740e3f20-76d1-45ec-ba01-17833b6c01e3',
    '01f52b4c-bbd9-4ac8-ac7b-bd840def34be',
    '0f67498f-a183-4596-bd75-8a001a4ee6e7',
    'a8f2d1c3-4b5e-6789-a012-3456789abcde',
];

// Mock KWin workspace API with UUID-based desktops
const mockWorkspace = {
    currentDesktop: { id: mockUUIDs[0] },
    desktops: [
        { id: mockUUIDs[0], x11DesktopNumber: 1, name: 'Desktop 1' },
        { id: mockUUIDs[1], x11DesktopNumber: 2, name: 'Desktop 2' },
        { id: mockUUIDs[2], x11DesktopNumber: 3, name: 'Desktop 3' },
        { id: mockUUIDs[3], x11DesktopNumber: 4, name: 'Desktop 4' },
    ],
    currentDesktopChanged: {
        connect: jest.fn(),
    },
    desktopsChanged: {
        connect: jest.fn(),
    },
};

const mockRegisterShortcut = jest.fn();
const mockReadConfig = jest.fn((key, defaultValue) => defaultValue);

// Set up global mocks
globalThis.workspace = mockWorkspace;
globalThis.registerShortcut = mockRegisterShortcut;
globalThis.readConfig = mockReadConfig;
globalThis.console = {
    log: jest.fn(),
    error: jest.fn(),
};

// Import the main script after setting up mocks
const fs = require('fs');
const path = require('path');

describe('LastUsedDesktops Integration', () => {
    let scriptContent;

    beforeAll(() => {
        const scriptPath = path.join(__dirname, '..', 'contents', 'code', 'main.js');
        scriptContent = fs.readFileSync(scriptPath, 'utf8');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockWorkspace.currentDesktop = { id: mockUUIDs[0] };

        // Reset desktops array
        mockWorkspace.desktops = [
            { id: mockUUIDs[0], x11DesktopNumber: 1, name: 'Desktop 1' },
            { id: mockUUIDs[1], x11DesktopNumber: 2, name: 'Desktop 2' },
            { id: mockUUIDs[2], x11DesktopNumber: 3, name: 'Desktop 3' },
            { id: mockUUIDs[3], x11DesktopNumber: 4, name: 'Desktop 4' },
        ];

        // Remove global instance before each test
        if (globalThis.lastUsedDesktops) {
            delete globalThis.lastUsedDesktops;
        }
    });

    test('should execute script without errors', () => {
        expect(() => {
            eval(scriptContent);
        }).not.toThrow();
    });

    test('should register history navigation shortcut on initialization', () => {
        eval(scriptContent);

        expect(mockRegisterShortcut).toHaveBeenCalledWith(
            'Last Used Virtual Desktops',
            'Navigate to previously used virtual desktop',
            'Meta+Tab',
            expect.any(Function),
        );

        // Should register shortcuts for 20 desktops (default max)
        for (let i = 1; i <= 20; i++) {
            expect(mockRegisterShortcut).toHaveBeenCalledWith(
                `Go to Desktop ${i}`,
                `Navigate to virtual desktop ${i} with toggle`,
                '',
                expect.any(Function),
            );
        }

        // Total calls: 1 (history) + 20 (desktops) = 21
        expect(mockRegisterShortcut).toHaveBeenCalledTimes(21);
    });

    test('should connect to workspace signals', () => {
        eval(scriptContent);

        expect(mockWorkspace.currentDesktopChanged.connect).toHaveBeenCalledWith(
            expect.any(Function),
        );

        expect(mockWorkspace.desktopsChanged.connect).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should initialize with current desktop in history', () => {
        eval(scriptContent);

        const script = globalThis.lastUsedDesktops;
        expect(script.desktopHistory).toEqual([mockUUIDs[0]]);
        expect(script.candidateIdx).toBe(null);
    });

    test('should build desktop mappings correctly', () => {
        eval(scriptContent);

        const script = globalThis.lastUsedDesktops;

        // Check desktopID mapping (desktop number → UUID)
        expect(script.desktopID[1]).toBe(mockUUIDs[0]);
        expect(script.desktopID[2]).toBe(mockUUIDs[1]);
        expect(script.desktopID[3]).toBe(mockUUIDs[2]);
        expect(script.desktopID[4]).toBe(mockUUIDs[3]);

        // Check desktopNum mapping (UUID → desktop number)
        expect(script.desktopNum[mockUUIDs[0]]).toBe(1);
        expect(script.desktopNum[mockUUIDs[1]]).toBe(2);
        expect(script.desktopNum[mockUUIDs[2]]).toBe(3);
        expect(script.desktopNum[mockUUIDs[3]]).toBe(4);
    });

    test('should export lastUsedDesktops globally', () => {
        // Clear any existing global
        if (globalThis.lastUsedDesktops) {
            delete globalThis.lastUsedDesktops;
        }

        eval(scriptContent);

        expect(globalThis.lastUsedDesktops).toBeDefined();
        expect(globalThis.lastUsedDesktops).toBeInstanceOf(Object);
    });

    test('should handle desktops without x11DesktopNumber', () => {
        // Test with missing x11DesktopNumber
        mockWorkspace.desktops[1].x11DesktopNumber = undefined;
        mockWorkspace.desktops[2].x11DesktopNumber = null;

        eval(scriptContent);

        const script = globalThis.lastUsedDesktops;

        // Should use array index + 1 as fallback
        expect(script.desktopID[1]).toBe(mockUUIDs[0]); // First desktop
        expect(script.desktopID[2]).toBe(mockUUIDs[1]); // Second desktop (index 1 + 1)
        expect(script.desktopID[3]).toBe(mockUUIDs[2]); // Third desktop (index 2 + 1)
        expect(script.desktopID[4]).toBe(mockUUIDs[3]); // Fourth desktop
    });
});
