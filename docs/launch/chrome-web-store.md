# Chrome Web Store launch checklist

Everything needed to take the extension on `main` from a local build to an
unlisted Chrome Web Store listing. Items marked **(you)** happen in a
dashboard only the account owner can reach; everything else is in a repo.

## 1. Before building

- [ ] **plover-server:** merge the endpoint cleanup, let `deploy.yml` create the
      candidate revision, check its `/health`, then promote it to 100% traffic
      (command in the server README). The extension only calls
      `POST /api/decompose`.
- [ ] **Website:** the privacy policy at `https://tryplover.com/privacy/policy`
      describes optional site access (the store reviews it against the
      manifest). Terms at `https://tryplover.com/terms` describe the free
      extension.
- [ ] **Supabase (you):** confirm the project the extension uses is active, the
      Google provider is enabled under Authentication → Providers, and decide
      whether email confirmation stays on. A free-plan project pauses after
      about a week without traffic; upgrade the account that owns it before
      testers depend on it.

## 2. Production build

Create `extension/.env.production` (git-ignored, like `.env`) with production
values:

| Variable | Value |
| --- | --- |
| `WXT_SUPABASE_URL` | the production Supabase project URL |
| `WXT_SUPABASE_ANON_KEY` | its anon (publishable) key, never the service-role key |
| `WXT_PLOVER_BACKEND_URL` | `https://plover-server-562340206018.us-central1.run.app` |
| `WXT_GOOGLE_CLIENT_ID` | the Google OAuth **Web application** client ID used for Calendar |

Then, from the repo root:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
pnpm --filter ./extension run zip
```

`wxt zip` builds for production and writes the upload zip to
`extension/.output/` (named after the package and its version, `0.1.0`). Load
`extension/.output/chrome-mv3` unpacked once and click through sign-in, task
breakdown, a short focus block, blocking and Calendar before uploading.

Bump `version` in `extension/package.json` for every later upload; the store
rejects a version it has already seen.

## 3. Extension ID and redirect URLs

Sign-in and Calendar redirect to `https://<extension-id>.chromiumapp.org/`,
and the ID of the store build differs from an unpacked build.

- [ ] **(you)** Create the item in the
      [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
      (one-time developer registration fee) and upload the zip as a draft. The
      item's ID is fixed from this first upload.
- [ ] **(you)** Add `https://<store-id>.chromiumapp.org/` to:
  1. Supabase → Authentication → URL Configuration → **Redirect URLs**
  2. Google Cloud Console → APIs & Services → Credentials → the Web
     application client → **Authorised redirect URIs**
- [ ] Optional: to test locally with the store ID, copy the public key from the
      dashboard's Package tab into a **local, uncommitted** `key` in
      `extension/manifest.config.ts` (see `docs/RUNNING.md`). Leave it out of
      the uploaded zip.

## 4. Google OAuth consent screen (you)

`calendar.readonly` is a sensitive scope. Until the app is verified, Google
shows an "unverified app" screen and caps it at 100 users.

- [ ] App name "Plover", support email, logo, homepage `https://tryplover.com`,
      privacy policy `https://tryplover.com/privacy/policy`, terms
      `https://tryplover.com/terms`.
- [ ] Authorised domain `tryplover.com`, verified in Google Search Console.
- [ ] Scopes: `.../auth/calendar.readonly` only, with this justification:
      "Plover shows the user's next calendar event inside the extension so a
      focus block doesn't run into a meeting. Events are read from the browser
      and never sent to Plover's servers."
- [ ] A short demo video showing Calendar connect and the next-event display.
- [ ] Submit for verification. For the first testers you can stay in Testing
      mode and add their Google accounts as test users.

Supabase's own Google sign-in only asks for basic profile scopes and needs no
verification.

## 5. Store listing

**Name:** Plover

**Summary** (from the manifest, ≤132 characters): A cute work buddy that keeps
you company while you focus: task steps, a Pomodoro timer and site blocking.

**Category:** Productivity. **Language:** English.

**Description:**

> Plover is a small work buddy that lives in your browser.
>
> - Break a big task into small steps. Plover suggests them, and you can edit
>   every one or write your own.
> - Run a Pomodoro timer. At the end of each work block, tick off the step
>   you finished.
> - Block distracting sites while you work. Focus mode starts the timer,
>   turns on blocking and keeps the buddy quiet, all in one switch.
> - See your next Google Calendar event so a focus block doesn't run into a
>   meeting (optional, read-only).
> - The buddy sits in a corner of the sites you choose and keeps you company.
>   It never reads the page.
>
> Your tasks stay in your browser. Plover needs a free account to sign in.

**Graphics:** 128×128 icon (`extension/public/icon/128.png`), at least one
1280×800 screenshot, and a 440×280 small promo tile.

## 6. Privacy practices tab

**Single purpose:** Plover helps you focus on work in your browser: it breaks
tasks into steps, runs a Pomodoro timer, and blocks sites you choose, with a
buddy character that keeps you company.

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | Saves tasks, timer state and settings in the browser. |
| `alarms` | Ends work and break blocks on time and refreshes the next calendar event. |
| `activeTab` | Lets the popup offer "Show Plover on this site" for the tab the user is looking at. |
| `declarativeNetRequest` | Blocks the sites on the user's blocklist during focus time. |
| `identity` | Opens Google's sign-in window for Plover sign-in and Google Calendar. |
| `notifications` | Asks which step the user finished at the end of a work block. |
| `scripting` | Shows the buddy on sites the user has allowed, by registering the buddy script for those sites only. |
| Optional host access (`<all_urls>`) | Requested only when the user allows the buddy on their pages or on a site, or blocks a site. The buddy only draws itself and reads nothing on the page. |

**Remote code:** No. All code ships in the package.

**Data use** (what leaves the device):

- **Personally identifiable information:** email address, for the Plover
  account.
- **Authentication information:** sign-in session with the account provider.
- **Website content, web history, user activity, location, personal
  communications:** not collected.
- Task text the user sends for step suggestions goes to Plover's server and
  Google's Gemini API and isn't stored. Calendar events go straight from Google
  to the browser.

**Certifications:** data is not sold, not used or transferred for purposes
unrelated to the single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** `https://tryplover.com/privacy/policy`

## 7. Submit

- [ ] **(you)** Distribution → Visibility: **Unlisted**.
- [ ] **(you)** Submit for review. Broad optional host access can add review
      time; the justifications above are what the reviewer reads.
- [ ] After approval, share the listing link (and add it to tryplover.com
      when the site leaves waitlist mode).
