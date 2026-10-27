---
name: plover-testing
description: Use when writing or debugging Vitest tests in this repo and hitting "Cannot access 'mockVariable' before initialization" from vi.mock hoisting, TS2532 "Object is possibly 'undefined'" combined with ESLint no-non-null-assertion in test files, or ESLint no-empty-function on stub methods in a vi.mock class.
---

# Plover Testing

## Overview

Footguns specific to writing Vitest tests in this repo: mocking pitfalls and TypeScript/ESLint interactions in test code.

## Quick reference

| Symptom / error                                                                                                          | Fix                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ReferenceError: Cannot access 'mockVariable' before initialization`                                                     | Declare mock vars with `vi.hoisted(...)`, not plain outer `const`/`let`                                                                                                  |
| `TS2532: Object is possibly 'undefined'` on `result[0].kind`, and `result[0]!.kind` fails ESLint `no-non-null-assertion` | Destructure + optional chaining: `const [r0] = result; expect(r0?.kind).toBe(...)`                                                                                       |
| ESLint `@typescript-eslint/no-empty-function` on stub methods in a `vi.mock` class (`start() {}`)                        | Use expression-bodied class fields: `start = () => undefined;` / `watch = async () => undefined;` (keep a real `class` body; Vitest 4 `new vi.fn(...)` mocks don't work) |

## Details

### vi.mock hoisted variable ReferenceError

**Symptom:** `ReferenceError: Cannot access 'mockVariable' before initialization` during Vitest runs.
**Root cause:** `vi.mock` is hoisted to the top of the file before outer variables are defined.
**Fix:** Use `vi.hoisted` to declare mock variables so they are initialized before any hoisted `vi.mock` blocks run.

### noUncheckedIndexedAccess + no-non-null-assertion forces destructure pattern in tests

**Symptom:** Test code using `result[0].kind` fails typecheck with `TS2532: Object is possibly 'undefined'` (tsconfig has `noUncheckedIndexedAccess`). Switching to `result[0]!.kind` then fails ESLint `@typescript-eslint/no-non-null-assertion`.
**Root cause:** Both rules are intentionally on together. There is no non-null-assertion escape hatch; tests must be written so the type system can prove non-`undefined`.
**Fix:** Destructure + optional chaining:

```ts
const result = listSomething();
expect(result).toHaveLength(2);
const [r0, r1] = result;
expect(r0?.kind).toBe("file_added");
```

When `r0` is undefined, `r0?.kind` is `undefined` and the `toBe(...)` assertion fails, same semantics as `!.` but lint-clean.

### Empty stub methods in vi.mock classes fail no-empty-function

**Symptom:** `pnpm lint` reports `Unexpected empty method 'start'` (`@typescript-eslint/no-empty-function`) on test mocks like `class { start() {} stop() {} }`.
**Root cause:** The rule applies to test files too, and Vitest 4 requires mocked constructors to be real `class` bodies (`vi.fn(() => ...)` with `new` fails).
**Fix:** Declare stubs as expression-bodied class fields: `start = () => undefined;`, `watch = async () => undefined;`. Non-empty bodies satisfy the rule without comments.
