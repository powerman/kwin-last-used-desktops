import './kwin';

interface LastUsedDesktopsTest {
    readonly desktopHistory: readonly string[];
}

declare global {
    interface GlobalThis {
        lastUsedDesktops: LastUsedDesktopsTest;
    }
}
