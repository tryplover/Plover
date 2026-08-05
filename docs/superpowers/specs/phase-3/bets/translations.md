# Bet 2 — Translations (stub)

**Status: stub.** Reserves the shape; expand into a full spec when picked up.

Make Plover work for non-English users: multi-language goal capture, subtask
decomposition, and nudges in the user's language.

## Rough shape (to be validated in brainstorming)

- Language detection / user language preference in `settings`.
- Localized decomposition + nudge prompts (Gemini already multilingual — mostly a
  prompt + output-language concern, not new infra).
- Localized renderer UI strings (introduce an i18n layer in `app/src/renderer`).

## Open questions

- Which languages first?
- Localize only agent *output*, or the whole UI chrome too?
- Do synced context sources (MCP bet) need per-source language handling, or is
  language purely an output concern?

## Cross-bet notes

- Independent of the MCP integrations bet, but agent output that quotes MCP-sourced
  content (emails, PRs, Notion) should render in the user's chosen language.

When picked up: brainstorm → full spec here → implementation plan under `docs/plans/`.
