# Feature: Windows Port & Platform Abstraction

> Read [../overview.md](../overview.md) first.

Expand Plover to support Windows 10/11, reaching feature parity with the macOS version. This involves refactoring platform-specific code into a clean abstraction layer.

## Scope

1. **Platform Abstraction Layer (PAL)**: Unified interfaces for tray icons, global hotkeys, window management, and native notifications.
2. **Windows Monitor Implementation**:
   - Screen capture using Windows Graphics Capture (WGC) or Desktop Duplication API.
   - Active window tracking via Win32 `GetForegroundWindow`.
   - Keystroke counting via `SetWindowsHookEx`.
3. **Installer & Auto-update**: Squirrel.Windows or MSIX based installer.
4. **Credential Management**: Transition from keytar (macOS Keychain) to Electron's native safeStorage API.
5. **UI Polish**: Windows-specific styling for the overlay and main window (Acrylic/Mica effects).

## Hard Constraints

- **Single Codebase**: Minimize platform-specific branching (`if (process.platform === 'win32')`) outside the PAL.
- **Privacy Parity**: Ensure Windows data collection (screen/keystrokes) follows the same strict opt-in and local-only rules.

## Implementation Order

1. Refactor existing macOS-specific logic into `app/src/main/platform/`.
2. Implement Windows-specific PAL modules.
3. Port native dependencies and ensure stable builds on Windows.
4. Implement Windows `Monitor` (screen tracking, active window).
5. Build and test Windows installer.
