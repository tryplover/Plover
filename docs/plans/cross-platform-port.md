# Implementation Plan: Windows & Linux Distros Port

This plan details the steps required to port the Plover desktop application to Windows and Linux. The majority of the codebase (Electron client, React frontend, SQLite repositories, and Google API integrations) is natively cross-platform. We only need to address:
1. **Active Window Focus Tracker**: Replacing macOS-only AppleScript with PowerShell on Windows and `xdotool` on Linux (X11).
2. **Build and Packaging Configuration**: Updating `electron-builder` settings to compile native binaries for Windows (`.exe` / `.msi`) and Linux (`.deb` / `AppImage`).

---

## Technical Design & Strategy

### 1. Cross-Platform Window Tracker (`app/src/main/activity/window-tracker.ts`)
We will refactor `getActiveWindowFromOS()` to detect `process.platform` and branch:

#### macOS (`darwin`) - Already Implemented
Runs the existing `osascript` to get frontmost process name and window title.

#### Windows (`win32`)
Runs a PowerShell command to invoke Win32 APIs (`GetForegroundWindow`, `GetWindowText`, `GetWindowThreadProcessId`) inline without requiring external C++ Node addons.
* **Inline PowerShell Command:**
  ```powershell
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); }'; $hwnd = [Win32]::GetForegroundWindow(); $tb = New-Object System.Text.StringBuilder 256; [void][Win32]::GetWindowText($hwnd, $tb, 256); $pid = 0; [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid); $p = Get-Process -Id $pid -ErrorAction SilentlyContinue; $name = if ($p) { $p.ProcessName } else { 'Unknown' }; Write-Output "$name|||$($tb.ToString())"
  ```

#### Linux (`linux`)
Runs an `xdotool` script to query active window information under X11 environments:
* **Shell script execution:**
  ```bash
  active_window_id=$(xdotool getactivewindow 2>/dev/null)
  if [ -n "$active_window_id" ]; then
    window_title=$(xdotool getwindowname "$active_window_id" 2>/dev/null)
    window_pid=$(xdotool getwindowpid "$active_window_id" 2>/dev/null)
    if [ -n "$window_pid" ]; then
      app_name=$(cat /proc/"$window_pid"/comm 2>/dev/null)
    fi
    echo "${app_name:-Unknown}|||${window_title:-Unknown}"
  else
    echo "Unknown|||Unknown"
  fi
  ```

---

### 2. Native C++ Rebuilds
* Electron native modules like `better-sqlite3` and `keytar` must compile for target operating systems. 
* `electron-builder` automatically invokes `electron-rebuild` when compile flags are run on target platforms.

---

### 3. Builder Packaging Configuration (`app/package.json`)
Add `win` and `linux` parameters to the `build` block:
```json
    "win": {
      "target": [
        "nsis",
        "portable"
      ],
      "icon": "resources/icon.ico"
    },
    "linux": {
      "target": [
        "AppImage",
        "deb"
      ],
      "category": "Utility"
    }
```

---

## Proposed Changes

#### [MODIFY] [window-tracker.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/app/src/main/activity/window-tracker.ts)
Update `getActiveWindowFromOS` to branch based on `process.platform`.

#### [MODIFY] [package.json](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/app/package.json)
Update the `build` configuration block to add `win` and `linux` packaging targets.

#### [MODIFY] [window-tracker.test.ts](file:///Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/app/tests/activity/window-tracker.test.ts)
Update mocks to simulate different platforms and ensure PowerShell and `xdotool` query paths are correctly executed and parsed.

---

## Verification Plan

### Automated Tests
- Run `pnpm test` to verify the refactored window tracker tests pass successfully.
- Verify mocks return correct process/window titles for simulated `win32` and `linux` platforms.

### Manual Verification
- **Windows**: Build and run Plover in a Windows VM or machine, verify active window logs show Windows processes (e.g. `chrome`, `explorer`) and titles correctly.
- **Linux**: Build and run Plover on a Linux box (with `xdotool` installed), verify active window logs show Linux application names.
