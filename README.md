# Last Used Virtual Desktops

[![License MIT](https://img.shields.io/badge/license-MIT-royalblue.svg)](LICENSE)
[![KDE Plasma 6+](https://img.shields.io/badge/KDE%20Plasma-6+-royalblue.svg?logo=kde-plasma&logoColor=white)](https://kde.org/plasma-desktop/)
[![JavaScript ES2020](https://img.shields.io/badge/JavaScript-ES2020-blue.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Test](https://img.shields.io/github/actions/workflow/status/powerman/kwin-last-used-desktops/test.yml?label=test)](https://github.com/powerman/kwin-last-used-desktops/actions/workflows/test.yml)
[![Release](https://img.shields.io/github/v/release/powerman/kwin-last-used-desktops?color=blue)](https://github.com/powerman/kwin-last-used-desktops/releases/latest)
[![KDE Store](https://img.shields.io/badge/KDE%20Store-Download-blue?logo=kde&logoColor=white)](https://store.kde.org/p/{ID})

A KWin script for KDE Plasma 6 that provides intelligent virtual desktop navigation
through history-based switching and desktop toggle functionality.

## Features

- **History-based navigation**:
  Switch to previously used virtual desktops using keyboard shortcuts.
- **Walk through history**:
  Quickly navigate through multiple previous desktops with successive key presses.
- **Desktop toggle functionality**:
  Jump to any desktop with one hotkey,
  then use the same hotkey to return to your previous desktop.

## Installation

### From KDE Store (Recommended)

1. Open **System Settings** → **Window Management** → **KWin Scripts**.
2. Click **Get New Scripts...**.
3. Search for "Last Used Virtual Desktops".
4. Click **Install**.

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/powerman/kwin-last-used-desktops/releases).
2. Install via command line:

    ```bash
    kpackagetool6 --install kwin-last-used-desktops.kwinscript --type KWin/Script
    ```

3. Or install via System Settings:
    - Open **System Settings** → **Window Management** → **KWin Scripts**.
    - Click **Import KWin Script...**.
    - Select the downloaded `.kwinscript` file.

### Building from Source

```bash
git clone https://github.com/powerman/kwin-last-used-desktops.git
cd kwin-last-used-desktops
mise run install
```

## Configuration

### Script Settings

You can configure the script behavior through the GUI:

1. Open **System Settings** → **Window Management** → **KWin Scripts**.
2. Find "Last Used Virtual Desktops" and ensure it's **enabled**.
3. Click the **Settings** button to configure:
    - **Continuation delay** (100-2000ms):
      Time window for successive key presses in history navigation.
    - **Enable debug output**:
      Show debug messages in console (useful for troubleshooting).

Settings are applied after script restart
(switch it off, click "Apply", then switch it on, click "Apply").

### Keyboard Shortcuts

1. Go to **Shortcuts** → **Global Shortcuts** → **KWin**.
2. Configure keyboard shortcuts for:
    - **Last Used Virtual Desktops**: Navigate to previously used desktop (default: `Meta+Tab`).
    - **Navigate to virtual desktop N with toggle**: Direct desktop navigation with toggle.

## Usage

### History Navigation

Press your configured history shortcut (default `Meta+Tab`) to:

- **First press**: Switch to the previously used desktop.
- **Subsequent presses** (within the configured continuation delay):
  Walk back through desktop history.

The continuation delay can be adjusted in the script settings (default: 500ms).

### Direct Desktop Navigation

Configure shortcuts for "Navigate to virtual desktop N with toggle" actions:

- **If not on target desktop**: Switch to the specified desktop.
- **If already on target desktop**: Toggle back to the previous desktop.

## Example Scenarios

### Scenario 1: History Navigation

You work on desktops in this order: 1 → 2 → 3 → 4 → 2.

- First `Meta+Tab`: Go to desktop 4.
- Quick second `Meta+Tab`: Go to desktop 3.
- Quick third `Meta+Tab`: Go to desktop 1.

### Scenario 2: Desktop Toggle

You're on desktop 1, press "Navigate to virtual desktop 5 with toggle":

- First press: Switch to desktop 5.
- Second press: Toggle back to desktop 1.
- Third press: Return to desktop 5.

## Inspiration

This project was inspired by [Lukas Erhard's kwin-walk-through-desktops](https://github.com/luerhard/kwin-walk-through-desktops).
Thanks to Lukas for the original idea and implementation approach!
