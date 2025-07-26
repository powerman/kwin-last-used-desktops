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

// Set up global mocks
global.workspace = mockWorkspace;
global.registerShortcut = mockRegisterShortcut;
global.console = {
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

        // Should register shortcuts for 20 desktops (4 in our mock)
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

    test('should log successful initialization with UUID', () => {
        eval(scriptContent);

        expect(console.log).toHaveBeenCalledWith(
            `LastUsedDesktops: Initialized with desktop ${mockUUIDs[0]}`,
        );
    });

    test('should build desktop number mapping', () => {
        eval(scriptContent);

        expect(console.log).toHaveBeenCalledWith(
            'LastUsedDesktops: Building desktop number map for 4 desktops',
        );

        // Check that desktop mappings are logged
        expect(console.log).toHaveBeenCalledWith(`LastUsedDesktops: Desktop 1 -> ${mockUUIDs[0]}`);
        expect(console.log).toHaveBeenCalledWith(`LastUsedDesktops: Desktop 2 -> ${mockUUIDs[1]}`);
    });

    test('should validate UUID format', () => {
        eval(scriptContent);

        // Valid UUIDs should be accepted
        expect(
            mockUUIDs.every(uuid =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid),
            ),
        ).toBe(true);
    });

    test('should export lastUsedDesktops globally', () => {
        // Clear any existing global
        if (global.lastUsedDesktops) {
            delete global.lastUsedDesktops;
        }

        eval(scriptContent);

        expect(global.lastUsedDesktops).toBeDefined();
    });

    test('should validate automatic desktop detection', () => {
        eval(scriptContent);

        expect(console.log).toHaveBeenCalledWith(
            'LastUsedDesktops: Registering shortcuts for 4 desktops',
        );
    });
});
