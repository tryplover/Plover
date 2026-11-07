# Block sites from the popup, with feedback

**Status:** Design, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4.4 (site blocking) and §6.1 point 5 (blocking without host access).

## 1. Problem

The user turns on **Block sites now** and "it doesn't do anything". The code works (`blocking/set` installs one `declarativeNetRequest` rule per blocklist entry), but:
- **The blocklist is empty by default**, so turning blocking on installs zero rules, and nothing is blocked.
- The only place to add sites is **Settings**, which until now opened as a dialog inside `chrome://extensions` (fixed separately: [settings in a tab](2026-11-07-settings-in-a-tab.md)).
- Turning blocking on gives **no feedback**: no count, no list, no message when there's nothing to block.
- Without host access, blocked sites get Chrome's plain error page instead of Plover's blocked page (§6.1), which looks broken.

## 2. Goals and non-goals

**Goals**
1. Blocking a site takes one or two clicks from the popup, without opening Settings.
2. The toggle never silently does nothing: with an empty list, it leads straight to adding sites.
3. The popup always shows what is blocked right now.

**Non-goals**
- Blocking outside the browser, schedules or allowlists (not in the MVP).
- Changing how rules are built (`features/blocking/rules.ts`) or the redirect/plain-block split.

## 3. User experience

### 3.1 Empty blocklist

Turning on **Block sites now** (or **Focus mode**) with an empty list opens an inline editor instead of doing nothing:

```
Block sites now                    [ ● on ]
┌────────────────────────────────────────┐
│ Which sites should wait?               │
│ [ + youtube.com ] (current tab)        │
│ Suggestions: [+ reddit.com] [+ x.com]  │
│              [+ instagram.com]         │
│ [ add a site…               ] [Add]    │
└────────────────────────────────────────┘
```

- **Current tab** chip: the active tab's domain, read through `activeTab` (already granted), shown when it's an http(s) page.
- **Suggestions:** a short fixed list of common distractions. One tap adds.
- Typed entries use the existing `normalizeDomain` validation and error text.
- Adding a site from here also requests host access for it (`siteOrigin(d)`, as the Settings blocklist already does), so it gets Plover's blocked page rather than Chrome's error.
- Blocking turns on as soon as the first site is added.

### 3.2 Blocking on, list not empty

```
Block sites now                    [ ● on ]
[ 3 sites blocked ▾ ]
```

- A chip (Figma Chip) with the count; tapping it expands the list with × to remove and the add field.
- Focus mode shows the same chip in its status row (Figma "Focus block" screen: "3 sites blocked").

### 3.3 Blocked page

Unchanged when Plover has access to the site. Without access, Chrome shows its error page; the popup chip notes "1 site can't show the Plover page. Allow". Allow requests access for those sites (one `permissions.request` with all their origins).

## 4. Implementation notes

- New `ui/components/BlockList.tsx`, shared by the popup and Settings (the Settings `DomainList` for blocked sites is replaced by it). It writes through `updateSettings`, and the worker's existing `storage.onChanged` listener re-installs rules while blocking is on.
- Pure helpers in `features/blocking/domains.ts`: `suggestedSites(blocklist)` (filters out sites already listed) and `currentTabDomain(url)`, unit-tested.
- Which blocked sites lack access: `hasHostAccess(domain, origins)` already exists in `features/site-access/origins.ts`.
- No new permissions.

## 5. Testing

- Unit: `suggestedSites`, `currentTabDomain`.
- Worker: unchanged rules behaviour; add a test that adding a site while blocking is on installs its rule.
- Playwright: empty list, then toggle on, then the editor shows; add `youtube.com`, then the rule is installed and the blocked page (or plain block) appears on navigation; the chip count updates.

## 6. Open questions

1. Should turning blocking on with an empty list leave the toggle **on** while the editor is open, or wait until a site is added? This design turns it on at the first add.
2. Which suggestions? Proposed: youtube.com, reddit.com, x.com, instagram.com, tiktok.com, facebook.com.
