declare global {
    var lastUsedDesktops: {
        desktopHistory: string[];
        candidateIdx: number | null;
        // Add more fields if needed for LSP/type safety
    };
}
export {};
