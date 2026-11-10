# QA loop config (Plover)

- repo: tryplover/Plover
- design_doc: docs/DESIGN.md
- planned_section: "## 9. Planned (designed, not built)"
- plans_dir: docs/plans
- checks: pnpm typecheck && pnpm lint && pnpm test && pnpm build
- e2e: pnpm build && pnpm e2e   # once DESIGN §8.5 ships
- run_product: |
    Build with `pnpm build` (output extension/.output/chrome-mv3). Copy it and set
    `host_permissions: ["<all_urls>"]` in the copy's manifest so the buddy draws headless.
    Launch it with Playwright `chromium.launchPersistentContext("", { channel: "chromium",
    args: [--disable-extensions-except=<dir>, --load-extension=<dir>] })`. The extension id
    comes from the service worker URL. Fake sign-in from the service worker:
    `chrome.storage.local.set({ needsSignIn: false, "sb-e2e-auth-token": "{\"access_token\":\"x\"}" })`.
    Pages are chrome-extension://<id>/{popup,options,task-history,welcome}.html; serve a local
    http page to see the buddy. There's no real network, so AI step suggestions fail by design.
- ui_paths: [extension/src/ui/, extension/src/entrypoints/ (except background.ts), "*.css", "*.html", user-visible copy]
- ui_draft_cap: 4
- personas: [procrastinating student, remote developer, meeting-heavy manager, first-time installer, keyboard-only / screen-reader user]
- hard_constraints: [local-only data (no Plover cloud sync), content script reads nothing from the page, no browsing-history logging, no keystroke content, no invented character art, outbound hosts limited to DESIGN §6]
- feedback_label: client-feedback
- branch_prefix: claude/
- cadence: hourly scheduled task into the session; chain items back-to-back
- extra_rules: [CLAUDE.md plan-then-delegate, DESIGN.md updated in the same PR (CI enforces it; `no-design-change` label for pure refactors)]
- blocked:
  - "DESIGN §9.15 Drive backup: the owner must add the drive.appdata scope to the Google OAuth consent screen"
