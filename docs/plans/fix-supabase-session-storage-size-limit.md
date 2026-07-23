# Fix: Supabase session storage exceeds Windows Credential Manager size limit

## Context

Live-debugged with the user on Windows. After fixing an unrelated Supabase
dashboard redirect-URL config issue, Google sign-in now correctly completes
the OAuth code exchange (confirmed: browser lands on
`localhost:44321/?code=...`, a real Supabase auth code), but the app then
shows "Authentication failed — Internal error occurred." The Electron main
process terminal logs the real cause:

```
[Auth] Sign-in failed: [Error: The stub received bad data.]
```

"The stub received bad data" is the classic Win32 `ERROR_BAD_STUB_DATA`
surfaced by `keytar` when a secret written via `CredWrite` exceeds Windows
Credential Manager's ~2.5KB per-entry blob size limit. The culprit is
`KeytarStorage` in `app/src/main/auth/supabase-client.ts`
(`app/src/main/auth/supabase-client.ts:10-20`), which is passed to
`@supabase/supabase-js` as the `auth.storage` adapter. After a successful
code exchange, the Supabase client tries to persist the full session
(access token JWT + refresh token + user object, JSON-serialized) via this
storage — Google-provider sessions especially carry extra claims and
comfortably exceed 2.5KB. `keytar.setPassword()` throws synchronously, which
propagates up through `exchangeCodeForSession()` uncaught, hits the generic
`catch` block in `supabase-auth.ts:117-121`, and produces the "Internal
error occurred" page — the OAuth flow itself is fine; only the final
session-persist step fails.

This is a genuine, unrelated bug from anything built earlier today — it
would affect email/password sign-in too, once the resulting session JSON
crosses the same size threshold (Google sessions hit it first because they
carry more claims).

## Fix

Replace `KeytarStorage`'s backing store for **this one thing** (the
Supabase session blob) with Electron's `safeStorage` module encrypting a
value written to a file under `app.getPath('userData')`, instead of
routing through the OS credential manager's small fixed-size slot. This
sidesteps the size limit entirely (it's just an encrypted file on disk,
same directory family as the app's SQLite DB) while keeping the same
"OS-backed encryption, not enabled" defensive checked rather than storing
plaintext.

Do **not** touch `app/src/main/auth/plover-token.ts` — that's a separate,
much smaller opaque token (unrelated to this bug, out of scope, confirmed
with user in an earlier session) and keytar is fine for it.

### `app/src/main/auth/supabase-client.ts`

- Replace the `KeytarStorage` class with a new class (e.g.
  `EncryptedFileStorage`) implementing the same `SupportedStorage`
  interface (`getItem`/`setItem`/`removeItem`), still ignoring the `key`
  argument the same way the current class does (comment already explains
  why: this app only ever caches one session per machine) — same behavior,
  different physical backing store.
- Use `safeStorage` from `'electron'` and `app.getPath('userData')` +
  `node:path`/`node:fs/promises` (or `fs.promises`) to read/write/delete a
  file, e.g. `supabase-session.enc`, in the userData directory.
- `getItem()`: if the file doesn't exist (`ENOENT`), resolve `null` (same
  "no session yet" semantics `keytar.getPassword` had when nothing was
  stored — don't throw for this case). Otherwise read the file, decrypt via
  `safeStorage.decryptString(buffer)`, return the string.
- `setItem(_key, value)`: encrypt `value` via `safeStorage.encryptString`,
  write the resulting buffer to the file.
- `removeItem()`: delete the file if present; treat `ENOENT` as success
  (already-removed), don't throw.
- Guard with `safeStorage.isEncryptionAvailable()` — if false, throw a
  clear `Error` from `setItem`/`getItem` rather than silently writing
  plaintext or silently losing data. (This should be rare — Electron's
  `safeStorage` backs onto DPAPI on Windows, Keychain on macOS, and
  libsecret/kwallet on Linux; only genuinely unusual environments lack it.)
- Keep the existing `getSupabaseClient()` singleton wiring — only the
  storage implementation passed into `createClient(...)` changes.
- The old orphaned `keytar` entry (service `plover`, account
  `supabase-session`) from before this fix can be left alone — it becomes
  inert or won't be enrolled anymore, no cleanup needed, no security
  concern.

### `app/tests/main/auth/supabase-client.test.ts`

Currently mocks `keytar` (`vi.mock('keytar', ...)`) and asserts the storage
adapter routes through `keytar.getPassword('plover', 'supabase-session')`
etc. — see the file for the exact shape. Rewrite these to mock `electron`'s
`safeStorage` (`encryptString`/`decryptString`/`isEncryptionAvailable`) and
Node's `fs/promises` (or whatever module the implementation ends up using)
instead, keeping equivalent coverage: singleton behavior (unchanged, don't
touch those two tests), `getItem` reads-and-decrypts, `setItem`
encrypts-and-writes, `removeItem` deletes, `getItem` on a missing file
resolves `null` rather than throwing, and `isEncryptionAvailable() ===
false` causes a thrown/rejected error rather than a silent bad write.

## Verification

1. `pnpm typecheck && pnpm lint && pnpm test` from repo root — must be
   green. (Note: if a `pnpm dev` Electron instance is running concurrently,
   the root `test` script's native-module rebuild step will fail with
   `EPERM` for unrelated reasons — see this repo's CLAUDE.md lessons-learned
   entry on concurrent sessions. Run `pnpm --filter ./app typecheck`,
   `pnpm --filter ./app run lint`, and `npx vitest run` directly from
   `app/` if that happens, same as done earlier today.)
2. Ask the user to retry "Sign In with Google" in the running app (no
   restart needed unless the main process changed requires one — Electron
   main-process changes do require a restart of `pnpm dev` to take effect).
   Confirm sign-in now completes and the sidebar/Settings reflect the
   signed-in state.
