import Database from 'better-sqlite3';

// better-sqlite3 v13 resolves its prebuilt binary from `prebuilds/${process.platform}-${process.arch}.node`
// on the first Database construction, then caches it. Tests that stub `process.platform` (e.g. to 'darwin')
// would otherwise make it load a binary for the wrong OS. Constructing one here pins the correct binary
// before any test file runs.
new Database(':memory:').close();

// An unstubbed fetch to a real host makes the suite depend on the runner's
// connectivity: it surfaces as an unhandled module-load error rather than an
// assertion, so the whole file reports as failed with nothing having run.
// Rejecting here instead makes that deterministic and names the call. Loopback
// is allowed through — signIn()'s OAuth redirect server is a real in-process
// listener that tests drive over http://localhost.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const realFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  let host: string | null = null;
  try {
    host = new URL(url).hostname;
  } catch {
    // Not an absolute URL — let the real implementation produce its own error.
    return realFetch(input, init);
  }

  if (LOOPBACK_HOSTS.has(host)) return realFetch(input, init);

  return Promise.reject(
    new Error(
      `Unmocked fetch to ${url}. Tests must not touch the real network — stub it with ` +
        `vi.stubGlobal('fetch', vi.fn()) or nock.`,
    ),
  );
}) as typeof globalThis.fetch;
