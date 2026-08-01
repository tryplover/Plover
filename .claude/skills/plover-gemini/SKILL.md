---
name: plover-gemini
description: Use when TypeScript reports "Property '0' does not exist on type '() => FunctionCall[] | undefined'" on a Gemini response, when accessing response.response.functionCalls from @google/generative-ai, or when Gemini calls fail with "429 Too Many Requests" / "Quota exceeded" on the free tier and need a model fallback strategy.
---

# Plover Gemini SDK quirks

## Overview
Covers two Gemini/`@google/generative-ai` footguns: the `functionCalls` accessor being a method not a property, and handling free-tier 429 quota exhaustion via model fallback.

## Quick reference
| Symptom / error | Fix |
|---|---|
| `Property '0' does not exist on type '() => FunctionCall[] \| undefined'` | Call `response.response.functionCalls()` as a function, not a property: `response.response.functionCalls()?.[0]` |
| Gemini call fails with `429 Too Many Requests` / `Quota exceeded` on free-tier key | Retry through an ordered list of fallback models before throwing (see `decompose.ts`) |

## Details

### `functionCalls` is a method, not a property
**Symptom:** `response.response.functionCalls[0]` causes TypeScript compiler error `Property '0' does not exist on type '() => FunctionCall[] | undefined'`.

**Root cause:** In the `@google/generative-ai` legacy SDK, `functionCalls` on the `EnhancedGenerateContentResponse` object is a function (getter method) that returns the list of function calls, not a direct array property.

**Fix:** Call it as a function: `response.response.functionCalls()?.[0]`.

### Automated model fallback for 429 quota exhaustion
**Symptom:** API calls to decompose goals fail with a `429 Too Many Requests` or `Quota exceeded` exception when using the free tier key.

**Root cause:** Free-tier Gemini keys have strict rate limits (15 RPM / 1500 RPD) or model-specific quotas.

**Fix:** Implement an automatic model recycling fallback loop in `app/src/main/planner/decompose.ts`. If the primary model (`GEMINI_MODEL` env var, defaulting to `gemini-2.0-flash`) fails, catch the exception, log a console warning, and retry using fallback models in order (`gemini-1.5-flash`, `gemini-2.0-flash-lite-preview-02-05`, `gemini-1.5-pro`, and other 2.5/3.x generations). Only throw if all candidate models fail. Note: since the client-server refactor, this fallback loop now executes on the backend proxy server, not the Electron client.
