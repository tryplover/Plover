import { join } from 'node:path';

try {
  // Load .env from the server root directory (one level up from src/)
  process.loadEnvFile(join(import.meta.dirname, '../.env'));
} catch {
  /* env may be set externally */
}
