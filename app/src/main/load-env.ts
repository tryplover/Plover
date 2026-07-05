import { join } from 'node:path';
import { existsSync } from 'node:fs';

try {
  const candidates = [
    join(import.meta.dirname, '../../.env'),
    join(import.meta.dirname, '../.env'),
    join(process.cwd(), 'app', '.env'),
    join(process.cwd(), '.env'),
  ];
  const appEnvPath = candidates.find((path) => existsSync(path));

  if (appEnvPath) {
    process.loadEnvFile(appEnvPath);
  }
} catch {
  // No .env file present — fall back to the ambient environment.
}
