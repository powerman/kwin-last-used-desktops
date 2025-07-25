# Last Used Virtual Desktops

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/javascript-ES2020-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![KDE Plasma](https://img.shields.io/badge/KDE%20Plasma-6.0+-blue.svg)](https://kde.org/plasma-desktop/)
[![Tests](https://github.com/powerman/kwin-last-used-desktops/actions/workflows/test.yml/badge.svg)](https://github.com/powerman/kwin-last-used-desktops/actions/workflows/test.yml)

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

1. Open **System Settings** → **Window Management** → **KWin Scripts**
2. Click **Get New Scripts...**
3. Search for "Last Used Virtual Desktops"
4. Click **Install**

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/powerman/kwin-last-used-desktops/releases)
2. Install via command line:

    ```bash
    kpackagetool6 --install kwin-last-used-desktops.kwinscript --type KWin/Script
    ```

3. Or install via System Settings:
    - Open **System Settings** → **Window Management** → **KWin Scripts**
    - Click **Import KWin Script...**
    - Select the downloaded `.kwinscript` file

### Building from Source

```bash
git clone https://github.com/powerman/kwin-last-used-desktops.git
cd kwin-last-used-desktops
mise run install
```

## Configuration

1. Open **System Settings** → **Window Management** → **KWin Scripts**
2. Find "Last Used Virtual Desktops" and ensure it's **enabled**
3. Go to **Shortcuts** → **Global Shortcuts** → **KWin**
4. Configure keyboard shortcuts for:
    - **Last Used Virtual Desktops**: Navigate to previously used desktop (default: `Meta+Tab`)
    - **Navigate to virtual desktop N with toggle**: Direct desktop navigation with toggle

## Usage

### History Navigation

Press your configured history shortcut (default `Meta+Tab`) to:

- **First press**: Switch to the previously used desktop.
- **Subsequent presses** (within 500ms): Walk back through desktop history.

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
