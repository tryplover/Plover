# Feature: Gemini-powered subtask decomposition

> Read [../core-architecture.md](../core-architecture.md) first.

Turn a free-form goal sentence into a structured `Goal` + an ordered list of `Task` subtasks.

## Scope

- `app/src/main/planner/gemini.ts` — Gemini client wrapper, tool/function definitions.
- `app/src/main/planner/decompose.ts` — single Gemini call with structured output (JSON schema or tool-calling).

No scheduling, no calendar writes, no DB writes. Pure planner output. Persistence is the caller's job (typically the IPC handler triggered by [typed-goal-capture.md](./typed-goal-capture.md) or [overlay-quick-add.md](./overlay-quick-add.md)).

## Module contract

```ts
export async function decomposeGoal(input: {
  goalText: string;
  now: Date;
  workingHours: { start: string; end: string }; // "09:00" .. "18:00"
}): Promise<{
  goal: Omit<Goal, 'id' | 'created_at' | 'updated_at' | 'status'>;
  subtasks: Array<Omit<
    Task,
    'id' | 'goal_id' | 'status' | 'created_at' | 'updated_at' |
    'scheduled_start' | 'scheduled_end' | 'calendar_event_id'
  >>;
}>;
```

## Prompt rules

- Subtasks **never** > 4 hr — split further.
- Subtasks **never** < 15 min — combine.
- Emit subtasks in dependency order; populate `depends_on` (JSON array of subtask indices/ids) when one truly requires another.

## Tech

- `@google/generative-ai` SDK.
- Gemini 2.x with **function/tool calling** for structured output. The tool definition lives in `gemini.ts`; `decompose.ts` invokes it.

## Tests

- Unit-test `decomposeGoal` against a mocked Gemini client. Verify the schema, the 15-min / 4-hr bounds enforcement, and that dependency ordering is preserved.
- No real Gemini calls in tests. TDD applies here per the implementation-order step 3.

## Acceptance criteria

- Goal *"Write a 5-page essay on octopus cognition by next Tuesday"* yields **3–7 subtasks** within ~5 s.
- All returned subtasks satisfy 15 min ≤ `estimate_minutes` ≤ 240.
