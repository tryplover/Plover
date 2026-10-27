import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  isSignedIn: async () => true,
  getAccessToken: async () => "TOKEN",
}));
import { dispatch } from "@/background/controller";
import { registerTaskHandlers } from "@/background/tasks";
import { getLocal, setLocal } from "@/lib/storage";

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

const ok = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
  });

beforeEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
  registerTaskHandlers();
});

describe("task/decompose", () => {
  it("returns steps", async () => {
    stubFetch(async () =>
      ok({ goal: { title: "g" }, subtasks: [{ title: "A" }, { title: "B" }] }),
    );
    expect(await dispatch({ type: "task/decompose", text: "g" })).toEqual({
      ok: true,
      data: { steps: ["A", "B"] },
    });
  });

  it.each([
    ["500", () => Promise.resolve(ok({}, 500))],
    ["429", () => Promise.resolve(ok({}, 429))],
    ["malformed json", () => Promise.resolve(ok("not json"))],
    ["network error", () => Promise.reject(new TypeError("offline"))],
  ])("falls back to aiFailed on %s", async (_n, impl) => {
    stubFetch(impl);
    expect(await dispatch({ type: "task/decompose", text: "g" })).toEqual({
      ok: true,
      data: { steps: [], aiFailed: true },
    });
  });

  it("401 also flags needsSignIn", async () => {
    await setLocal({ needsSignIn: false });
    stubFetch(async () => ok({}, 401));
    expect(await dispatch({ type: "task/decompose", text: "g" })).toEqual({
      ok: true,
      data: { steps: [], aiFailed: true },
    });
    expect(await getLocal("needsSignIn")).toBe(true);
  });

  it("aborts after 15s and reports aiFailed", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_u: string, init: RequestInit) =>
          new Promise((_r, rej) => {
            init.signal?.addEventListener("abort", () =>
              rej(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const p = dispatch({ type: "task/decompose", text: "g" });
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await p).toEqual({
      ok: true,
      data: { steps: [], aiFailed: true },
    });
    vi.useRealTimers();
  });
});

describe("task/decompose does not block the queue", () => {
  it("timer alarm and timer/pause proceed while fetch is pending", async () => {
    const { registerTimerHandlers } = await import("@/background/timer");
    registerTimerHandlers();
    await dispatch({ type: "timer/start" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)),
    );
    void dispatch({ type: "task/decompose", text: "g" });
    const res = await dispatch({ type: "timer/pause" });
    expect(res.ok).toBe(true);
    expect((await getLocal("timer")).pausedAt).not.toBeNull();
  });
});
