# Plover pivot: removal and retirement sweep

Reviewed October 10, 2026. This is an inventory and proposed sequence, not authorization to delete every listed module or implement the new design.

## Finding

The largest remaining mismatch is runtime behavior, not unused files. The repository says tracking and connectors are frozen, but startup still initializes collectors and pollers; old preferences can keep them active. Removing the percentage engine alone does not produce a timer-only buddy. The onboarding, task setup, website, and documentation also still sell the previous progress-tracker product.

The cleanup should remove the old product's active behavior and promises first, preserve the infrastructure earmarked for possible reuse, and defer physical deletion of shared modules and stored data until their consumers and migration requirements are resolved.

## Basis and limits

- App/design snapshot: `tryplover/Plover` main, `dc8d30d85a54180515ecdf21f0719a1172fd396b` (merged design publication #411).
- Backend snapshot: `tryplover/plover-server` main, `2c304fb4ff389d719777049b59432cfa7fb61d5a`.
- Website snapshot: `tryplover/plover-website` main, `eb8362a893392c7cd7d904a932a5694cf031d8ef`.
- Read the conversation, draft pivot spec, review report, selected design handoff, source files, dependency imports, tests inventory, and open PR scopes. Checked the release repository README; no release assets were removed.
- App main was inspected separately from the unmerged cleanup stack. This avoids counting the same work twice.
- No live website, native app session, deployed Cloud Run revision, account settings, or production usage logs were tested. Repo registrations describe source behavior, not proof of deployed behavior or an individual user's enabled settings.
- This sweep changes no application, backend, website, design, database, credentials, or release behavior. Only this report was written. No code tests were run for this source review.

Conversation constraints govern the recommendations: one small purpose per PR; no implementation of the newly published design yet; self-reported completion; optional, consensual personalization; preserve existing sensing/request infrastructure for possible activity-aware reminders. That reminder proposal is documentation-only and does not approve capture, upload, or renewed inference.

The draft also says frozen code should remain in place pending a separate deletion decision. Reviewer suggestions such as optional AI/manual start are recommendations to resolve in the session design, not automatic additions to approved scope.

## Already covered, but not merged

| PR | Narrow change | What remains afterward |
|---|---|---|
| [#408](https://github.com/tryplover/Plover/pull/408) | Stops constructing/starting the automatic progress inference engine | Collector startup, screen/Vision processing, stored percentages, engine implementation, and summary correction remain |
| [#409](https://github.com/tryplover/Plover/pull/409) | Stops Git-commit task matcher startup | Local Git commit collection, matcher implementation, backend route, historical summaries remain |
| [#410](https://github.com/tryplover/Plover/pull/410) | Removes floating `+X%` feedback, its event hook, animation files, and settings toggle | Ordinary percentages/blended bars and the saved preference/bridge fields remain |
| [#411](https://github.com/tryplover/Plover/pull/411) | Publishes selected design documents/assets | Merged; app implementation deliberately pending |

#408 → #409 → #410 remain open as of this sweep. Do not create duplicate retirement PRs or describe their changes as already active on main.

## Remove from active behavior; preserve implementations for now

| Priority | Area and evidence | Recommended boundary | Verification for its future PR |
|---|---|---|---|
| High | Screen capture and Vision: `app/src/main/activity/index.ts:47`; `sources/system/screen-capturer/screen-capturer.ts:47,70,84,119,171` | Stop this pipeline running in the pivot, including with old saved capture/Vision flags enabled. Preserve code for evaluation. #408 does not cover it. | Previously enabled flags and granted OS permission still produce no capture, files, or `/api/infer-screen` requests; unrelated decomposition still works. |
| High | Window/file/commit collection: `app/src/main/activity/index.ts:30,56,76`; settings defaults at `store/repos/settings.ts:97` | Establish an effective runtime freeze for pivot collection, rather than merely changing defaults for new users. Retain sources, activity storage, and retention. Local Git commit collection has no direct settings gate and must be included in the lifecycle analysis. | Fresh and migrated profiles, watched folders, and queued events produce no new collection; lifecycle is idempotent; retention continues for existing data. |
| High | Google/GitHub pollers: `app/src/main/index.ts:135–176`; credential restoration at `ipc/index.ts:18–19` | Stop starting context pollers in the pivot. Loading old credentials and pausing collection are distinct concerns; retain auth/storage code until disconnect/migration behavior is decided. | Previously connected accounts cause no Docs/Gmail/Calendar/Classroom/GitHub polling; app Supabase authentication still restores. |
| High | Activity context in AI breakdown: `app/src/main/ipc/goals.ts:10–20,35`; `planner/decompose.ts:38`; default `planner_useRecentActivityContext` at settings line 114 | Stop attaching recent computer activity to `/api/decompose`. Keep typed task text → breakdown. Old activity history must not silently become new planning context. | Request contains intended task input and no `recentActivity`, even with an enabled legacy preference and populated Activity table. |
| Medium | Working-hours scheduling: `app/src/main/ipc/goals.ts:56`; `planner/goal-manager.ts`; `planner/schedule.ts` | Decouple new task creation from schedule generation when the pivot flow is specified. Keep decomposition and local task persistence. Do not delete scheduling before its call sites and client/server contract are updated. | Creating a task no longer creates calendar slots; accepted step order/manual completion and existing task readability survive. |

These are separate cleanup purposes. If collection freezing touches multiple collectors, it must still be one coherent runtime policy with a clear regression test, not an opportunity to include connectors, UI redesign, or schema deletion.

## Remove or rewrite old user-facing surfaces

These findings identify future cleanup scopes; they do not implement the selected design.

1. **Screen-permission onboarding step.** `renderer/main/pages/Onboarding/Onboarding.tsx:50–53,111–113` calls screen-recording APIs. `StepGrantAccess.tsx` says the permission is required. Remove this requirement for the pivot and adjust progression without rebuilding the entire wizard. Regression: finish onboarding without screen permission/request/settings launch.
2. **Old onboarding promises and synthetic progress demo.** `StepPromise.tsx:14–38` claims selected windows and no stored pictures. `StepTaskCarousel.tsx` says the bar fills automatically; `CarouselMockup.tsx` shows watching/progress. Remove those promises/demo from the active flow or rewrite their copy around actually available behavior. The bundled welcome video (`StepWelcome.tsx` imports `renderer/Plover-Demo.mp4`) needs content review before deciding replacement; this sweep did not play it.
3. **Task setup window-selection stage.** `overlay/SetupFlow/SetupFlow.tsx` always routes breakdown → connect and displays “Tracking started.” `overlay/steps/StepConnect/StepConnect.tsx:53–58` explicitly says the selected window is not sent or saved, yet the UI promises “I only look at the one window you pick.” Remove this stage and its monitoring claims while preserving accepted-plan commit and error handling. Only afterward consider deleting its exclusive `AppRow` component/styles/tests.
4. **AI Progress page/navigation.** `renderer/App.tsx` exposes `AIProgress`; the page reads summaries and supports correction/reassignment. Retire this page from the primary experience. Coordinate with item 5 so historical summaries do not become a hidden route back to estimation.
5. **Summary mutation IPC.** `main/ipc/summaries.ts` exposes undo/reassign; `main/store/correction.ts:6–31` reverses/applies old deltas and can mark another task done. These operations are user-triggered rather than new automatic inference, but preserve the old attribution model. Decide whether historical undo remains a transitional recovery tool. Retire reassignment/application after the page is retired; do not delete all summary data as part of UI removal.
6. **Blended bars and task percentages.** `shared/goal-progress.ts` combines completed-step count with `current.progress / 100`; Home/GoalCard, `companion/useCompanionState.ts`, Collapsed and Expanded render it. #410 removes only popups. Existing inferred percentages can remain visible indefinitely after #408. Stop presenting those values as inferred current progress; separately decide whether to use an explicit self-reported step count. Keep manual complete/undo/switch/edit/reorder controls. UI replacement remains a future scoped decision.
7. **Tracking settings and context-connect controls.** `Settings/sections/ActivityTrackingSection`, `Settings.tsx` permission/Vision handlers, and `AccountSection` Google Docs tracking controls are outside pivot v1. Remove or hide their enabling paths after runtime freezing. Keep app sign-in/sign-out: “Sign in with Google” via Supabase is different from connecting Google Docs and must not be removed by a text-based sweep.
8. **Scheduling settings.** `SchedulingSection` exposes working hours/horizon/pause scheduling. Remove from the pivot settings when scheduling is decoupled. Timer settings are future functionality, not a rename of working hours.
9. **Observing/uncertainty states and pause promises.** `companion/useCompanionState.ts` and StatusIndicator/Collapsed/Expanded use `observing`/`not-sure`. `ipc/overlay.ts:70–73` only changes displayed companion state; it does not pause collectors. Remove misleading monitoring wording and define real session pause semantics during the later buddy state work. README's “pause is a hard kill-switch” is not established by this companion handler.
10. **Dashboard-first shell.** Home/goals list and the main sidebar are old planning UI, but immediate wholesale deletion would remove the only working task-management path. Retain until the new task-at-hand flow, resumption, and keyboard access exist. Main-window fate is still an open product question.

## Backend inventory (separate repository)

Source: [plover-server](https://github.com/tryplover/plover-server/tree/2c304fb4ff389d719777049b59432cfa7fb61d5a).

`python/plover/app.py:39–52` still registers `/api/infer-progress`, `/api/match-commit`, and `/api/infer-screen`. Associated route modules, Gemini declarations in `gemini_config.py`, and route tests remain. The service is **Python/FastAPI**, not the Express backend still described in the app's AGENTS.md.

- **Progress estimation and commit matching:** candidates for endpoint retirement after client changes are merged and compatibility with already distributed app builds is decided. Do not remove both endpoints, shared Gemini infrastructure, and auth in one PR.
- **Screen inference:** preserve implementation for possible future reuse. It currently produces screenshot summaries/context, not a validated on-task/off-task reminder classifier. Disable pivot client usage now; backend availability and eventual reuse are separate decisions.
- **Decomposition contract:** `routes/decompose.py:59–116` reads working hours and recent activity; working hours are validated as required. Coordinate simplification with the app client. Do not simply delete `workingHours` from requests before backend compatibility exists.
- **Keep:** decomposition, Gemini transport/retries/sanitization, Supabase auth, health checks, rate limits, Firestore counter support, Cloud Run deployment. Dropping obsolete routes does not justify removing safeguards used by decomposition.

No deployed routes were called and no backend changes or deployments were made.

## Website inventory (separate repository)

Source: [plover-website](https://github.com/tryplover/plover-website/tree/eb8362a893392c7cd7d904a932a5694cf031d8ef).

The flags in `src/config/features.js` correctly retain waitlist mode and hide pricing/Why Plover. They do not remove the landing-page narrative: `src/routes/Landing.jsx` still renders Hero, HowItWorks, WhoFor, Privacy, Idea, FAQ, and the demo.

| Surface | What needs retirement or correction |
|---|---|
| `src/locales/en.json` | “A Progress Bar That Works,” automatic tracking, accurate work feedback, “measures whether the work moved,” and tracking-based benefit claims. Reconcile separate feature promises with what is built versus proposed. |
| Hero/demo | `HeroVisual.jsx`, `HeroPanels/PanelP4–P7`, `PloverTaskDemoStep3/4` simulate watched-window selection and automatically filling percentages. Remove from current promotion or replace in a later design PR. |
| Privacy copy | Landing privacy section, FAQ, `/privacy`, and `/privacy/policy` promise one-window-only capture, immediate image disposal, and no screenshot storage. Those promises conflict with the desktop source's `types: ['screen']` capture and filesystem persistence when enabled. Correct factual scope; do not claim monitoring-free builds until runtime retirement is delivered. |
| Search/share metadata | `index.html`, `scripts/prerender.mjs`, locale meta fields, and Landing's FAQ JSON-LD repeat old claims. Updating only visible headings leaves obsolete promises in search and link previews. Treat metadata consistency as its own scope. |
| Hidden pages | Pricing and Why Plover are gated, not deleted. Keep gates; archive or rewrite old content before re-enabling. Pricing/business terms have not been settled by the design selections. |
| Static brand/demo assets | Review OG covers, screenshots, logo/type assets and historical demos when implementing the new identity. Do not bulk-delete assets without checking imports/static URLs. |

Keep waitlist submission, validation, routing, accessibility, auth needed by existing accounts, and payment/history endpoints needed by existing users. The pivot alone does not authorize erasing subscriptions or customer records. This sweep inspected website source, not the live deployed pages; publish/redeploy is separate work.

## Documentation and design cleanup

- **Publish the already requested monitoring note.** The review working copy still has uncommitted changes in the pivot spec and original review report (75 added lines). The optional activity-aware reminder proposal is not present in inspected main. Publishing the design system did not publish these notes. A small documentation PR should record the reuse boundary before anyone deletes the infrastructure.
- **Update entry-point instructions.** AGENTS.md still describes the progress tracker/scheduler, cites the original product spec as authoritative, and describes an Express proxy. CLAUDE.md has pivot context but still freezes features by prose. README mixes planned timer/check-in behavior with present tense and says runtime tracking is frozen. Give agents one current scope and accurately distinguish implemented/frozen/planned behavior.
- **Park obsolete build plans visibly.** `docs/plans/progress-signal-rewire.md` still reads like an actionable AI-progress/verification implementation plan; mark paused/superseded at its own entry point. Mark old tracking/connectors/phase roadmaps historical rather than deleting research or rewriting old reviewer submissions.
- **Update privacy statements to match actual effective behavior.** README's image-upload exceptions/monitor indicator and absolute backend-storage claims require verification; hard constraints, implementation, and future proposals must be distinguishable. The HTTP allowlist helper is documentation/validation code rather than proof every outbound path enforces it.
- **Preserve the selected design system.** `design/system/choices.selected.json` and matching token selections are the authority for eight chosen options. Full SPEC details are still proposed; implementation is deferred. Do not delete design boards or earlier mascot/logo studies merely because they contain superseded options; label/navigation can make their historical role clearer.
- **Resolve stale references in the pivot spec later.** It still says character/design are open despite the selected handoff. Keep timer defaults, launch OS, main-window fate, reminder/check-in precedence, and migration policy as real open questions. Updating documentation is different from shipping UI.
- **Review binaries before replacement.** The old application logos/icons, two `Plover-Demo.mp4` locations, and published release artifacts are candidates for a future asset audit, not immediate deletions. Keep historical releases accessible unless a separate release policy is agreed.

## Dependencies, schemas, tests: do not bulk-delete

- Keep SQLite, goals/tasks/sessions repos and migration history. The sessions table is reusable; it is not evidence that a focus timer exists. Task scheduling/progress fields, summaries, sync cursors, and activity rows need a migration/retention decision before removal. Do not clear or reset user history during a visual cleanup.
- Keep activity sources, `get-windows`, `chokidar`, and associated tests while preserving that infrastructure. Keep `googleapis`, `google-auth-library`, and `keytar` while connector/auth code still imports them. If connectors are later physically deleted, update package/lockfile, native rebuild scripts, and native build approvals together in that dependency-focused scope.
- Keep Electron, frameless window infrastructure, hide/show/resize, task controls, Supabase session storage, and decomposition transport. They are the reusable core.
- Inter/Instrument Serif imports, external font links, old CSS tokens, app icons, and old logo references belong to later design implementation. Removing fonts now would break the current UI and would violate the instruction to defer design implementation.
- Keep tests for preserved frozen modules. Retire tests only with their removed production feature; add meaningful regression coverage at lifecycle/IPC boundaries for runtime freezes and migrated flags. Do not lower coverage thresholds to make a deletion pass.
- Preserve normal CI, release signing, and Dependabot tooling. Old integration-specific updates may become unnecessary after dependency deletion; that is not a reason to turn off dependency maintenance now.

## Proposed queue: one purpose per PR

The order below is a recommendation, not work already performed. Runtime fixes can be reviewed in parallel with documentation/website copy where dependencies permit.

1. Publish the existing optional-monitoring reuse note; no behavior changes.
2. Merge the existing #408 → #409 → #410 cleanup stack.
3. Stop pivot screen capture/Vision execution, including legacy enabled flags.
4. Freeze remaining local activity collection, preserving retention and source code.
5. Stop context-connector polling startup; preserve app auth.
6. Remove recent activity from task-decomposition requests.
7. Remove the onboarding screen-permission requirement.
8. Remove the setup flow's watched-window selection stage; preserve plan commit.
9. Retire AI Progress navigation/page; resolve historical undo versus reassignment before a separate IPC cleanup.
10. Remove stale inferred percentage contribution from user-facing progress, after choosing step-count presentation.
11. Retire user-facing tracking enablement/settings, after effective runtime freeze.
12. Correct old onboarding/empty-state promises as a focused copy cleanup.
13. Remove scheduling from new plan creation, coordinating the backend contract; scheduling settings follow separately.
14. Correct website tracking/benefit copy; website privacy and metadata/demo cleanup are separately reviewable purposes.
15. Update current agent instructions/docs; mark paused plans historical.
16. Consider physical deletion of progress-only engines/endpoints/settings only after reuse and compatibility decisions. Keep that work separate from new UI features.

**Recommended next cleanup after the open stack:** stop the independent screen capture/Vision path. It is a concrete remaining runtime behavior with a clear test boundary, and stopping it preserves the infrastructure you asked us to keep.

## Exit criteria for the retirement pass

A fresh install and a migrated profile with all old tracking flags enabled can start/manage a task without requesting screen permission, collecting computer activity, polling context sources, sending activity/images to inference, or applying AI/commit completion. Manual task status and essential task access remain functional. The UI/site do not imply automatic knowledge of work progress. Historical data and reusable infrastructure remain intact under an explicit policy. Each completed scope has its own small PR and appropriate regression checks.

These criteria do not mean the pivot is built. The timer, real session pause/resume, check-in policy, recovery flow, and selected UI remain future implementation work.
