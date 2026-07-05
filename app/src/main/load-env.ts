import { join } from 'node:path';
import { existsSync } from 'node:fs';

try {
  const appEnvPath = join(process.cwd(), 'app', '.env');
  const rootEnvPath = join(process.cwd(), '.env');

  if (existsSync(appEnvPath)) {
    process.loadEnvFile(appEnvPath);
  } else if (existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
} catch {
  // No .env file present — fall back to the ambient environment.
}
