import { execFile } from 'node:child_process';
import { ActivityRepo } from '../store/repos/activity.js';
import { SettingsRepo } from '../store/repos/settings.js';

export class WindowTracker {
  private activityRepo: ActivityRepo;
  private settingsRepo: SettingsRepo;
  private intervalId: NodeJS.Timeout | null = null;
  private lastApp: string | null = null;
  private lastTitle: string | null = null;
  private lastLogTime = 0;
  private isChecking = false;

  constructor(activityRepo: ActivityRepo, settingsRepo: SettingsRepo) {
    this.activityRepo = activityRepo;
    this.settingsRepo = settingsRepo;
  }

  start(): void {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      console.log(
        '[WindowTracker] Window tracking is only supported on macOS (darwin) and Windows (win32). Skipping start.',
      );
      return;
    }
    if (this.intervalId) {
      return;
    }
    this.intervalId = setInterval(() => {
      void this.checkActiveWindow();
    }, 10000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async checkActiveWindow(): Promise<void> {
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      return;
    }
    if (this.isChecking) {
      return;
    }
    this.isChecking = true;

    try {
      const settings = this.settingsRepo.getAll();
      if (settings.pauseScheduling) {
        return;
      }

      const { app, title } = await this.getActiveWindowFromOS();

      const now = Date.now();
      const hasChanged = app !== this.lastApp || title !== this.lastTitle;
      const reachedTimeLimit = now - this.lastLogTime >= 60000;

      if (hasChanged || reachedTimeLimit) {
        this.lastApp = app;
        this.lastTitle = title;
        this.lastLogTime = now;
        this.activityRepo.log('window_focus', { app, title });
      }
    } catch (err) {
      console.error('Error tracking active window:', err);
    } finally {
      this.isChecking = false;
    }
  }

  private getActiveWindowFromOS(): Promise<{ app: string; title: string }> {
    return new Promise((resolve, reject) => {
      if (process.platform === 'darwin') {
        const appleScript = `tell application "System Events"
    set frontmostProcess to first process whose frontmost is true
    set productName to name of frontmostProcess
    set titleOfWindow to "Unknown"
    try
        tell process productName
            set titleOfWindow to name of window 1
        end tell
    end try
    return productName & "|||" & titleOfWindow
end tell`;

        execFile('osascript', ['-e', appleScript], (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }

          const output = stdout.trim();
          const parts = output.split('|||');
          const app = parts[0]?.trim() || 'Unknown';
          const title = parts[1]?.trim() || 'Unknown';

          resolve({ app, title });
        });
      } else if (process.platform === 'win32') {
        const psCommand = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); }'; $hwnd = [Win32]::GetForegroundWindow(); $tb = New-Object System.Text.StringBuilder 256; [void][Win32]::GetWindowText($hwnd, $tb, 256); $pid = 0; [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid); $p = Get-Process -Id $pid -ErrorAction SilentlyContinue; $name = if ($p) { $p.ProcessName } else { 'Unknown' }; Write-Output "$name|||$($tb.ToString())"`;

        execFile(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', psCommand],
          (error, stdout) => {
            if (error) {
              reject(error);
              return;
            }

            const output = stdout.trim();
            const parts = output.split('|||');
            const app = parts[0]?.trim() || 'Unknown';
            const title = parts[1]?.trim() || 'Unknown';

            resolve({ app, title });
          },
        );
      } else {
        reject(new Error('Unsupported platform'));
      }
    });
  }
}

export function listActiveWindows(): Promise<{ app: string; title: string }[]> {
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const appleScript = `tell application "System Events"
    set output to ""
    set processList to every process whose visible is true
    repeat with proc in processList
        try
            set procName to name of proc
            set winName to name of window 1 of proc
            if winName is not "" then
                set output to output & procName & "|||" & winName & linefeed
            end if
        end try
    end repeat
    return output
end tell`;

      execFile('osascript', ['-e', appleScript], (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const lines = stdout.split('\n');
        const results: { app: string; title: string }[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === '""') continue;
          const parts = trimmed.split('|||');
          const app = parts[0]?.trim() || 'Unknown';
          const title = parts[1]?.trim() || 'Unknown';

          if (app !== 'Finder' && title !== 'Unknown') {
            results.push({ app, title });
          }
        }
        resolve(results);
      });
    } else if (process.platform === 'win32') {
      const psCommand = `Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { "$($_.ProcessName)|||$($_.MainWindowTitle)" }`;

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psCommand],
        (error, stdout) => {
          if (error) {
            resolve([]);
            return;
          }

          const lines = stdout.split(/\r?\n/);
          const results: { app: string; title: string }[] = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parts = trimmed.split('|||');
            const app = parts[0]?.trim() || 'Unknown';
            const title = parts[1]?.trim() || 'Unknown';

            if (app !== 'explorer' && title !== 'Unknown') {
              results.push({ app, title });
            }
          }
          resolve(results);
        },
      );
    } else {
      resolve([]);
    }
  });
}
