# Buddy on every tab, until you hide it

**Status:** Design, not implemented. **Date:** 2026-11-07.
**Extends:** [pivot spec](2026-10-02-desktop-buddy-pivot-spec.md) §4.1 (floating buddy) and §6.1 (site access).

## 1. Problem

The user expects the buddy on every tab. In practice it shows nowhere. Their extension details page lists only *Block content on any page* and *Display notifications*, so Plover has **no site access**.

Since 2026-10-27 (spec §6.1), site access is an **optional** permission:
- It is requested once, on the welcome page that opens on install ("Let Plover hang out on your pages").
- If that page is skipped, closed or never shown, nothing asks again. Reloading an unpacked build doesn't count as an install, so developers and testers who reload never see the welcome page.
- The popup only offers **per-site** access ("Show Plover on this site"), and only on the current tab, so there's no way to say "every site" after install.
- Settings has no site-access control at all.

The result: the core feature, a buddy on your pages, is off for anyone who missed one prompt, and the extension never says so.

## 2. Goals and non-goals

**Goals**
1. A user can turn the buddy on for **all sites** from the popup and from Settings at any time, not only on the welcome page.
2. When the buddy can't appear anywhere, the extension **says so** and offers the fix in one click.
3. Once on, the buddy stays on every tab, including tabs already open, until the user hides it (per site or everywhere, as today).

**Non-goals**
- Making site access a required install-time permission. That brings back the "Read and change all your data on all websites" warning at install, which §6.1 removed on purpose.
- Showing the buddy on pages Chrome forbids for extensions (`chrome://`, the Web Store, the PDF viewer, the new-tab page).

## 3. User experience

### 3.1 Popup banner when the buddy has no access

When `permissions.contains({ origins: ["<all_urls>"] })` is false, the popup's idle screen shows a banner above "What are you working on?":

```
┌──────────────────────────────────────────┐
│ (bird) Plover isn't on your pages yet.   │
│ [Show Plover on all sites]   Just this site │
└──────────────────────────────────────────┘
```

- **Show Plover on all sites** calls `permissions.request({ origins: ["<all_urls>"] })` directly in the click handler (a user gesture is required). Chrome shows its own dialog.
- **Just this site** is the existing per-site grant.
- Dismiss (×) hides the banner for 7 days (`storage.local`, per-viewer convenience), then it comes back.
- Hidden once all-sites access is granted.
- Styling: the Figma conflict and nudge box (bg-quiet, card radius), Compact and Text buttons.

### 3.2 Settings: a "Where Plover appears" section

Replaces the current "Buddy" checkbox:

```
WHERE PLOVER APPEARS
Show Plover on all sites           [ toggle ]
Hide the buddy everywhere          [ toggle ]
Sites without the buddy            [ example.com ] [Add]
```

- **Show Plover on all sites**: on requests `<all_urls>`; off calls `permissions.remove({ origins: ["<all_urls>"] })`, which also removes the buddy from every tab.
- The toggle reflects the real permission state and updates live on `permissions.onAdded` and `onRemoved` (the user can also change it in `chrome://extensions`).

### 3.3 After granting

Already implemented in `features/site-access/worker.ts`: `permissions.onAdded` re-registers the buddy content script and injects it into every open tab. No reload is needed. This design only adds ways to *trigger* the grant.

### 3.4 Hiding

Unchanged: click the buddy for **Hide on this site** or **Hide everywhere**; both are undone from Settings. "Hide everywhere" is separate from site access, so access stays granted and showing it again needs no new prompt.

## 4. Implementation notes

- `ui/components/SiteAccess.tsx` (popup) gains the all-sites path and the banner layout. Pure helper `bannerState(granted, dismissedUntil, now)` in `features/site-access/origins.ts`, unit-tested.
- Options page: new section; reuses `ALL_SITES` from `features/site-access/origins.ts` (not `worker.ts`, per the lint rule).
- No new permissions; `<all_urls>` is already in `optional_host_permissions`.
- Welcome page: unchanged, but its "declined" text should point to the popup banner.

## 5. Testing

- Unit: `bannerState`.
- Playwright (default build, no host access): the banner shows; dismissing it hides it; with a pre-granted build the banner is absent and the buddy is on a page.
- Manual in Chrome: grant from the popup, and the buddy appears on already-open tabs without a reload; turn it off in Settings, and the buddy disappears.

## 6. Open questions

1. Should the banner also appear in the **in-page panel**? It can't, by definition: the panel only exists on pages with access. Popup and Settings only.
2. Should a first-run tip on the popup explain the bird before asking? This design keeps it to one line.
