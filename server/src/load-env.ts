import { join } from 'node:path';
import { existsSync } from 'node:fs';

try {
  const candidates = [
    join(import.meta.dirname, '../.env'),
    join(process.cwd(), 'server', '.env'),
    join(process.cwd(), '.env'),
  ];
  const envPath = candidates.find((path) => existsSync(path));
  if (envPath) {
    process.loadEnvFile(envPath);
  }
} catch {
  /* env may be set externally */
}
