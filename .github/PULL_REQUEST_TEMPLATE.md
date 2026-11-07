## Summary

<!-- 1-3 sentences describing what changed and why. -->

## Test plan

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Manually exercised the change (describe how below if applicable)

<!-- For UI changes, attach a screenshot or short clip. -->

## Design check

- [ ] Checked the diff against [docs/DESIGN.md](../docs/DESIGN.md): architecture rules (§2.3), permissions, network and privacy (§6), and scope (§1.5)
- [ ] Updated `docs/DESIGN.md` in this PR if the design changed (new state, message, permission, host, surface or user-visible behaviour), or added the `no-design-change` label and said why
- [ ] No new outbound network destinations beyond the allowlist in `CLAUDE.md` (`plover-server`, Supabase, `accounts.google.com`, `www.googleapis.com`)
- [ ] No new extension permissions or host permissions requested without discussion
