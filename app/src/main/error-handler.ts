import { app, crashReporter } from 'electron';
import { join } from 'node:path';
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';

export function initErrorHandler(): void {
  // 1. Electron Native Crash Reporter (writes minidumps to userData/Crashpad)
  crashReporter.start({
    submitURL: '', // Provide empty string to disable upload
    uploadToServer: false,
    compress: true,
  });

  // 2. Uncaught exceptions and unhandled promise rejections logging
  const logErrorToFile = (type: string, error: Error | unknown) => {
    try {
      const userDataPath = app.getPath('userData');
      const logsDir = join(userDataPath, 'logs');

      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      const crashLogPath = join(logsDir, 'crash.log');
      const timestamp = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.stack || error.message : String(error);

      const logEntry = `[${timestamp}] [${type}]\n${errorMessage}\n\n`;
      appendFileSync(crashLogPath, logEntry, 'utf8');

      console.error(`[CRASH] ${type} logged to ${crashLogPath}`);
    } catch (fsError) {
      // Fallback if we can't even write to the file system
      console.error('Failed to write crash log:', fsError);
    }
  };

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logErrorToFile('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    logErrorToFile('unhandledRejection', reason);
  });
}
