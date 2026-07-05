import { join } from 'node:path';
import { existsSync } from 'node:fs';

try {
  // Load .env from the app root directory (two levels up from src/main/)
  const appEnvPath = join(import.meta.dirname, '../../.env');

  if (existsSync(appEnvPath)) {
    process.loadEnvFile(appEnvPath);
  }
} catch {
  // No .env file present — fall back to the ambient environment.
}
