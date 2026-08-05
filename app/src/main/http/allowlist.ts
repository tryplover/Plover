export const ALLOWED_HOSTS = Object.freeze([
  'generativelanguage.googleapis.com',
  'www.googleapis.com',
  'gmail.googleapis.com',
  'calendar.googleapis.com',
  'classroom.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
  'api.github.com',
]);

export function assertAllowedHost(urlOrHost: string): void {
  let host = urlOrHost;
  try {
    host = new URL(urlOrHost).host;
  } catch {
    // already a bare host
  }
  if (!ALLOWED_HOSTS.includes(host)) {
    throw new Error(`Outbound host not allowed: ${host}`);
  }
}
