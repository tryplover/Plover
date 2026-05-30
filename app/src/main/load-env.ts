try {
  process.loadEnvFile();
} catch {
  // No .env file present — fall back to the ambient environment.
}
