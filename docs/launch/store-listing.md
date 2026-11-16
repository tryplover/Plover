# Chrome Web Store listing copy

The text and graphics plan for the Plover store listing. Paste from here into
the [developer dashboard](https://chrome.google.com/webstore/devconsole). The
launch steps are in [chrome-web-store.md](chrome-web-store.md).

## Where each field comes from

| Field | Source | Change needs a new version? |
| --- | --- | --- |
| Title (≤75 characters) | `name` in `extension/manifest.config.ts` | Yes |
| Summary (≤132 characters) | `description` in `extension/manifest.config.ts` | Yes |
| Description, screenshots, promo tile, category | Dashboard → **Store listing** | No |

Every change goes through store review, both a new version and a dashboard edit.
To review them together: save the dashboard edits as a draft (do not submit),
then push the version tag. The store reviews the draft and the package as one
submission. Chrome also shows `name` in the extensions menu; `short_name` and
the toolbar tooltip (`manifest.default_title` in the popup's `index.html`) stay
"Plover".

**Search:** an **unlisted** item does not show in store search. The keywords
below only work once the listing is **Public**. While it is unlisted, this copy
only changes how many people with the link install.

## Title

```text
Plover: Cute Pomodoro Timer, Site Blocker & Focus Buddy
```

55 characters. The first ~35 characters (shown before the search grid cuts the
title) hold the brand and the highest-traffic term.

## Summary

```text
Work next to a cute buddy, not alone. Plover is a little bird that acts as your Pomodoro timer, site blocker and task planner.
```

126 characters.

## Description

Under 5 uses of every keyword, so the store's keyword-spam check has nothing to
flag. Every claim matches `docs/DESIGN.md`; change this text when a feature it
names changes.

```text
Plover is a cute focus buddy that keeps you company while you work in your browser. Tell it what you need to do and it breaks the job into small steps, runs a Pomodoro timer and blocks the sites that pull you away.

PLOVER IS PRIVATE
• Plover asks for no site access when you install it. You choose where the buddy appears.
• It never reads the page you are on and never logs your browsing history.
• Your to-do list and history stay on your device.
• Free account: sign in with Google or email in seconds.

WHAT YOU GET

✦ Break big tasks into small steps
Type "Write the intro of my history essay." You get a short, clear plan. Edit or delete any step, or write your own.

✦ Pomodoro timer with a gentle check-in
Work for 25 minutes, rest for 5, and take a 15-minute break after every 4 rounds. Easily editable inside of settings. When a session ends, Plover asks which step you finished, and one click ticks it off.

✦ Website blocker for deep work
Add YouTube, Reddit, X, Instagram or anything else to your list. While you work, those sites show a blocked page instead.

✦ Focus mode in one switch
Starting focus mode starts the timer and turns on blocking, making Plover quietly sit at the side of your screen, waiting on you to finish up your tasks.

✦ A study buddy on every page
Plover sits in a corner of the page and holds a clock with your time left. Think of it as a virtual body double: someone to work next to. Drag it to any corner, pick its size, or hide it on any site.

✦ Google Calendar heads-up (optional, read-only)
Connect your calendar to get a warning before a session runs into a meeting, making sure you're always prepared for upcoming events.

✦ History and stats
See your focus time, Pomodoros and finished work by day and week. Export to CSV or JSON.

WHO IT IS FOR
Students, writers, developers and anyone who works alone on long projects: essays, problem sets, theses and side projects. It is made for people who find it hard to start and to stay on one thing, including many people with ADHD. If plain timers and to-do apps feel too cold, Plover gives you a friend to work next to.

WORKS IN
Chrome, Microsoft Edge, Brave, Arc and other Chromium browsers. Press Alt+Shift+O to open it.

Privacy policy: https://tryplover.com/privacy
```

**Category:** Productivity. **Language:** English.

## Screenshots (1280×800)

Screenshot 1 shows first; most visitors see only 1 and 2. Headline 56–64 px,
subline 28–32 px, one idea per slide, real UI only.

| # | Headline | Subline | Image |
| --- | --- | --- | --- |
| 1 | A cute focus buddy for your browser | Small steps, a Pomodoro timer and site blocking. | A Google Doc page, the buddy bottom-right holding its green clock, the panel open. Bottom strip: "No page reading · Tasks stay on your device · Free". |
| 2 | Big task? Get small steps. | Plover suggests a plan. You edit every step. | The popup with "Write the intro of my history essay" and 4 steps, **Start** highlighted. |
| 3 | Focus for 25. Break for 5. | One gentle check-in at the end of each session. | The buddy's bubble "Which step did you finish?" with step buttons; toolbar badge "12". |
| 4 | Distractions? Blocked. | One switch starts the timer and stops the sites you pick. | The blocked page for youtube.com: "Blocked while focus mode is on · Next break in 08:42". Inset: the Focus mode switch. |
| 5 | Private by design | Never reads your pages. No browsing history. Works in Chrome, Edge, Brave and Arc. | Settings → **Where Plover appears** with **Buddy size**. Inset: the calendar heads-up "Team sync starts in 5 min". |

## Small promo tile (440×280)

The buddy large on the left, "Plover" on the right, and one line under it:
**Your cute focus buddy**. No other text; the tile shows small in search
results. Cream brand background so it stands out on the store's white page.

## Keywords

Estimates, not store data. To check a term, type it in the store search box and
look at the suggestions and the user counts of the top results.

| Term | Volume | Competition | Used in |
| --- | --- | --- | --- |
| pomodoro timer | Very high | Very high | Title, summary, description |
| website blocker / block sites | High | Very high | Title, description |
| focus timer / study timer | High | High | Description |
| study buddy | Medium | Low | Description |
| focus buddy / focus companion | Low–medium | Very low | Title, description |
| cute pomodoro / cute timer | Medium | Low | Title, summary |
| body doubling / virtual body double | Medium, growing | Very low | Description |
| pomodoro with tasks / to-do | Medium | Medium | Summary, description |
| ADHD focus | Medium | Medium | Description (once) |

Plover's fastest wins are "cute", "buddy" and "body double": no large timer or
blocker shows a character on the page or breaks tasks into steps.

**Rules:** never name a competitor in the listing (store keyword-spam policy).
"Pomodoro" is a registered trademark; many listings use it, but it is a known
risk.
