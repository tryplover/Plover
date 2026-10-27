# Extension optional site access Plan

> **For agentic workers:** implement one PR section at a time, in order. Steps use checkbox (`- [ ]`) syntax. Run every command from the repo root unless noted.

**Goal:** Installing Plover asks for no site access. Site access is an optional permission granted from a welcome page (all sites) or from the popup (one site). The buddy content script is registered at runtime for whatever origins are granted, and blocking falls back to plain DNR `block` rules where there is no host access.

**Spec:** [pivot spec §6.1](../superpowers/specs/2026-10-02-desktop-buddy-pivot-spec.md) (resolved 2026-10-27).

## Global constraints

- Worker-only code lives in `features/<name>/worker.ts` or `src/worker/*`; `src/ui/**` and page entrypoints never import them (ESLint `no-restricted-imports`). Pure logic goes in a non-`worker.ts` file so pages can share it.
- Every state/config write from a browser event goes through `enqueue` (`@/worker/queue`). Never `await enqueue()` from inside a queued task (deadlock).
- No new dependencies. No comments unless the WHY is non-obvious.
- Tests mock `chrome.*` APIs that `fakeBrowser` lacks by assigning onto it: `(fakeBrowser as unknown as Record<string, unknown>).scripting = { ... }` (same pattern as `declarativeNetRequest` in `tests/features/focus/worker.test.ts`). `fakeBrowser.reset()` drops listeners, so register in `beforeEach`.
- `pnpm typecheck && pnpm lint && pnpm test` green at every PR in the stack.

## Facts checked in WXT 0.21.4 (don't re-derive)

- `defineContentScript({ registration: "runtime" })` keeps the script out of `manifest.content_scripts` but **adds its `matches` to `host_permissions`** (`wxt/dist/core/utils/manifest.mjs`). So the runtime script must declare **no `matches`** (validation allows that only for runtime registration).
- The built file is `content-scripts/content.js` (entrypoint `src/entrypoints/content/index.tsx`). `cssInjectionMode: "ui"` inlines CSS into the shadow root, so no CSS file needs registering.
- `ContentScriptContext` posts `wxt:content-script-started` on start and older instances of the same script invalidate themselves, so injecting into a tab that already runs the buddy replaces it rather than doubling it.
- WXT's auto web-accessible entry for `content-scripts/content.css` (fetched by `createShadowRootUi` in `ui` mode) also copies the script's `matches`, so with none it gets `matches: []`. Add an explicit `{ resources: ["content-scripts/content.css"], matches: ["<all_urls>"], use_dynamic_url: true }` WAR entry.
- Dev mode (`wxt` serve) always adds `tabs` + `scripting` permissions; only check `pnpm build` output for permissions.

## Stack

| PR | Branch | Base | Content |
| --- | --- | --- | --- |
| A | `ext/10-runtime-buddy-script` | `docs/extension-host-permissions` | this plan, manifest, runtime content-script registration + re-sync |
| B | `ext/11-welcome-page` | A | welcome entrypoint + `onInstalled` opener |
| C | `ext/12-site-grant-blocking` | B | popup "Show Plover on this site", blocking redirect/block fallback, blocklist add requests access |

---

## PR A — manifest + runtime registration

### Files

- Modify `extension/manifest.config.ts`
- Modify `extension/tests/manifest.test.ts`
- Modify `extension/src/entrypoints/content/index.tsx` (only the `defineContentScript` options)
- Create `extension/src/features/site-access/origins.ts` (pure)
- Create `extension/src/features/site-access/worker.ts`
- Modify `extension/src/entrypoints/background.ts`
- Modify `extension/src/worker/reconcile.ts`
- Create `extension/tests/features/site-access/origins.test.ts`
- Create `extension/tests/features/site-access/worker.test.ts`
- Modify `extension/tests/worker/reconcile.test.ts` (stub `permissions`/`scripting`)

### Steps

- [ ] **Manifest.** `permissions: ["storage", "alarms", "declarativeNetRequest", "identity", "notifications", "scripting"]` (drop `tabs`), remove `host_permissions`, add `optional_host_permissions: ["<all_urls>"]`. Keep `web_accessible_resources` unchanged: WAR `matches` grant no host access and add no install warning; `panel.html` must stay loadable in any page the buddy runs on, and `blocked.html` must stay reachable for DNR redirects.
  - Why `tabs` can go: its only uses read `tab.url` (`notifyCheckIn` in `features/timer/worker.ts`, `redirectOpenTabs` in `features/blocking/worker.ts`). Without `tabs`, `tab.url` is present exactly for tabs Plover has host access to, which is where the buddy can be visible and where redirecting is possible. `notifyCheckIn` sees `undefined` on a tab without access and correctly falls back to a notification.
- [ ] **Manifest test.** Update the permission list; assert `host_permissions` is `undefined` and `optional_host_permissions` equals `["<all_urls>"]`.
- [ ] **Pure origins** in `features/site-access/origins.ts`:

```ts
import { httpHostname } from "@/shared/host";

export const ALL_SITES = "<all_urls>";

export function buddyMatches(origins: string[]): string[] {
  if (origins.includes(ALL_SITES)) return [ALL_SITES];
  return [...new Set(origins.filter((o) => /^(\*|https?):\/\//.test(o)))].sort();
}

export function originForUrl(url: string | undefined): string | null {
  const host = url ? httpHostname(url) : null;
  return host ? `*://${host}/*` : null;
}
```

  Tests: `<all_urls>` collapses everything to `["<all_urls>"]`; http/https/`*://` origins pass through deduped and sorted; `chrome-extension://…`, `file:///*` and empty input give `[]`. `originForUrl`: `https://www.x.com/a?b` → `*://www.x.com/*`; `chrome://newtab`, `undefined`, junk → `null`.

- [ ] **Worker** in `features/site-access/worker.ts`:

```ts
import { browser } from "wxt/browser";
import { buddyMatches } from "@/features/site-access/origins";
import { enqueue } from "@/worker/queue";

const BUDDY_SCRIPT_ID = "plover-buddy";
const BUDDY_SCRIPT_FILE = "content-scripts/content.js";

export async function syncBuddyScript(): Promise<void> {
  const { origins = [] } = await browser.permissions.getAll();
  const matches = buddyMatches(origins);
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [BUDDY_SCRIPT_ID] });
  if (matches.length === 0) {
    if (existing.length > 0) await browser.scripting.unregisterContentScripts({ ids: [BUDDY_SCRIPT_ID] });
    return;
  }
  const script = { id: BUDDY_SCRIPT_ID, js: [BUDDY_SCRIPT_FILE], matches, runAt: "document_idle" as const, persistAcrossSessions: true };
  if (existing.length > 0) await browser.scripting.updateContentScripts([script]);
  else await browser.scripting.registerContentScripts([script]);
}

export async function injectBuddy(origins: string[]): Promise<void> {
  const matches = buddyMatches(origins);
  if (matches.length === 0) return;
  const tabs = await browser.tabs.query({ url: matches });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    await browser.scripting
      .executeScript({ target: { tabId: tab.id }, files: [BUDDY_SCRIPT_FILE as ScriptPublicPath] })
      .catch(() => undefined);
  }
}

export function registerSiteAccess(): void {
  browser.permissions.onAdded.addListener(({ origins }) => {
    if (!origins?.length) return;
    void enqueue(syncBuddyScript).then(() => injectBuddy(origins));
  });
  browser.permissions.onRemoved.addListener(({ origins }) => {
    if (!origins?.length) return;
    void enqueue(syncBuddyScript);
  });
}
```

  Adjust types to whatever `wxt/browser` accepts (`runAt` may need a cast like the DNR enums). `executeScript` failures (restricted pages such as the Web Store) are expected and ignored.

- [ ] **Content script.** Replace `matches: ["<all_urls>"]` with `registration: "runtime"` in `src/entrypoints/content/index.tsx`. Nothing else in that file changes.
- [ ] **Wiring.** `background.ts`: call `registerSiteAccess()` next to the other `register*` calls. `worker/reconcile.ts`: inside the existing `enqueue`, also `await syncBuddyScript()` (so `onStartup` and `onInstalled` re-sync).
- [ ] **Worker tests** (`tests/features/site-access/worker.test.ts`), with `permissions.getAll`, `permissions.onAdded/onRemoved.addListener` (capture the listener), `scripting.{getRegisteredContentScripts,registerContentScripts,updateContentScripts,unregisterContentScripts,executeScript}` and `tabs.query` as `vi.fn`s:
  - no granted origins + nothing registered → no register/unregister calls;
  - no origins + registered → unregister `plover-buddy`;
  - `<all_urls>` granted + nothing registered → `registerContentScripts([{ id: "plover-buddy", js: ["content-scripts/content.js"], matches: ["<all_urls>"], … }])`;
  - granted + already registered → `updateContentScripts` with the new matches;
  - `onAdded({ origins: ["*://x.com/*"] })` → re-sync, then `tabs.query({ url: ["*://x.com/*"] })` and `executeScript` once per tab with an id; a rejected `executeScript` does not throw;
  - `onRemoved` → re-sync (unregister when nothing is left).
  - Wait for listener work with `await vi.waitFor(() => expect(...))` or flush the queue with `await enqueue(async () => undefined)`.
- [ ] **reconcile test**: stub `permissions.getAll` (→ `{ origins: [] }`) and `scripting.getRegisteredContentScripts` (→ `[]`) in `beforeEach`; add one case asserting a registration happens when `<all_urls>` is granted.
- [ ] **Build check.** `pnpm build`, then confirm in `extension/.output/chrome-mv3/manifest.json`: no `host_permissions`, no `content_scripts`, `optional_host_permissions: ["<all_urls>"]`, and that `content-scripts/content.js` exists.

---

## PR B — welcome page

### Files

- Create `extension/src/shared/links.ts`: `export const PRIVACY_POLICY_URL = "https://tryplover.com/privacy";` (placeholder until the real policy is published)
- Create `extension/src/entrypoints/welcome/index.html` (copy of `options/index.html`, title "Welcome to Plover"), `main.tsx`, `welcome.css`
- Modify `extension/src/features/site-access/worker.ts`: add `openWelcome()`
- Modify `extension/src/entrypoints/background.ts`
- Extend `extension/tests/features/site-access/worker.test.ts`

### Steps

- [ ] `openWelcome()`: `await browser.tabs.create({ url: browser.runtime.getURL("/welcome.html") })`. Run `pnpm --filter ./extension exec wxt prepare` after adding the entrypoint so `"/welcome.html"` is a known `PublicPath`.
- [ ] `background.ts`: `browser.runtime.onInstalled.addListener(({ reason }) => { void reconcile(); if (reason === "install") void openWelcome(); });`
- [ ] Welcome page (`main.tsx`), three ordered sections, reusing `useExtensionState` and `SignIn` (no new auth flow):
  1. **Sign in.** `local.needsSignIn ? <SignIn /> : <p>Signed in.</p>`
  2. **Privacy.** One sentence ("Your tasks stay on this device…") and `<a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">Read the privacy policy</a>`.
  3. **Site access.** Explain that the buddy only draws itself in a corner and reads nothing on the page, then a button **"Let Plover hang out on your pages"** whose `onClick` calls `browser.permissions.request({ origins: ["<all_urls>"] })` directly (no `await` before it: the user gesture must still be live). Track `granted` from `browser.permissions.contains({ origins: [ALL_SITES] })` on mount and from `permissions.onAdded/onRemoved`; when granted, replace the button with "Plover is on your pages. You can change this in chrome://extensions any time." If declined, say the popup still works and can add Plover one site at a time.
  - Import `ALL_SITES` from `@/features/site-access/origins` (pure file, allowed); never from `worker.ts`.
- [ ] Style like `options.css` (simple centered column), import `@/ui/base.css`.
- [ ] Test: `onInstalled` with reason `install` opens one tab at `welcome.html`; reason `update` opens none. Test `openWelcome` directly with `vi.spyOn(fakeBrowser.tabs, "create")`; keep the `onInstalled` branching trivial in `background.ts`.

---

## PR C — per-site grant + blocking fallback

### Files

- Modify `extension/manifest.config.ts` + `tests/manifest.test.ts`: add `activeTab` (no install warning; gives the popup the current tab's URL)
- Modify `extension/src/features/site-access/origins.ts`: add `siteOrigin`, `hasHostAccess`
- Modify `extension/src/features/blocking/rules.ts`, `features/blocking/worker.ts`
- Modify `extension/src/features/site-access/worker.ts`: re-apply blocking on permission changes
- Create `extension/src/ui/components/SiteAccess.tsx`; modify `ui/components/Panel.tsx`
- Modify `extension/src/entrypoints/options/main.tsx`
- Tests: `origins.test.ts`, `rules.test.ts`, `site-access/worker.test.ts`, `focus/worker.test.ts` (stub `permissions.getAll`)

### Steps

- [ ] **Pure helpers** in `origins.ts`:

```ts
export function siteOrigin(domain: string): string {
  return `*://*.${domain}/*`;
}

export function hasHostAccess(domain: string, origins: string[]): boolean {
  return origins.some((o) => {
    if (o === ALL_SITES) return true;
    const m = /^\*:\/\/([^/]+)\/\*$/.exec(o);
    const host = m?.[1];
    if (!host) return false;
    if (host === "*") return true;
    if (!host.startsWith("*.")) return false;
    const base = host.slice(2);
    return domain === base || domain.endsWith(`.${base}`);
  });
}
```

  Why wildcard scheme + subdomains only: a DNR rule with `requestDomains: [d]` matches `d` and every subdomain over http and https; a redirect only fires where Plover has host access to the request URL, so anything narrower than `*://*.d/*` would leave some requests unblocked. `*.d` in a match pattern also matches `d` itself. Tests: `<all_urls>`, `*://*/*`, `*://*.youtube.com/*` (matches `youtube.com` and `m.youtube.com`), `*://*.com/*` (matches), `*://youtube.com/*` (no: no subdomains), `https://*.youtube.com/*` (no: one scheme), unrelated origin (no).

- [ ] **Rules.** `buildRules(blocklist: string[], origins: string[])`: action is `{ type: "redirect", redirect: { extensionPath: BLOCKED_PAGE } }` when `hasHostAccess(domain, origins)`, else `{ type: "block" }` (cast like the existing enum casts). Update `rules.test.ts`: all-sites → redirect for every domain; no origins → block for every domain; mixed list → per-domain choice; ids stay 1..n.
- [ ] **Blocking worker.** `installRules` reads `const { origins = [] } = await browser.permissions.getAll()` and passes it to `buildRules`. `redirectOpenTabs` stays as is (tabs without access have no `url` and are skipped; the plain block applies on their next load).
- [ ] **Re-apply on permission change.** In `registerSiteAccess`, both listeners enqueue `async () => { await syncBuddyScript(); if (await getLocal("blockingOn")) await reapplyBlocking(); }`. Test: with `blockingOn: true`, `onAdded` re-installs rules with redirect actions; with `blockingOn: false`, rules are not touched.
- [ ] **focus/worker.test.ts** and any other test that reaches `installRules`: stub `permissions.getAll` → `{ origins: ["<all_urls>"] }` so the existing redirect expectations hold.
- [ ] **Popup button** `ui/components/SiteAccess.tsx`:
  - on mount: `browser.tabs.query({ active: true, currentWindow: true })` → `originForUrl(tab?.url)`; if `null` render nothing; else `browser.permissions.contains({ origins: [origin] })`.
  - when not contained: `<button type="button" className="plover-link" onClick={() => void browser.permissions.request({ origins: [origin] }).then(setGranted)}>Show Plover on this site</button>`; render nothing once granted.
  - render `<SiteAccess />` in `Panel` only when `surface === "popup"`, above `body`.
  - The worker's `onAdded` listener does the registration + injection, so the popup does nothing else (it may close when Chrome's dialog takes focus).
- [ ] **Options blocklist.** `DomainList` gets an optional `onAdd?: (domain: string) => void`, called in `add()` right after validation and before `onChange` (synchronous, so the click/Enter gesture is still live). For "Blocked sites": `onAdd={(d) => void browser.permissions.request({ origins: [siteOrigin(d)] })}`. A decline is fine: the site gets a plain block. "Sites without the buddy" passes no `onAdd`.
- [ ] Build check again: `pnpm build`; manifest has `activeTab`, still no `host_permissions`.

## Verification (every PR)

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm build
```

## Not verifiable without a real browser

- Chrome's permission dialogs (welcome all-sites grant, popup per-site grant, blocklist add) and whether the popup survives its dialog.
- The registered script actually loading on new pages and injection into already-open tabs.
- DNR `block` vs `redirect` behaviour on sites with and without access.
- Re-sync after toggling site access in `chrome://extensions`.
