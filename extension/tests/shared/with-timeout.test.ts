import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "@/shared/with-timeout";

afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("returns the result and clears the timer", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(1000, async () => 7)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts the signal after the timeout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const p = withTimeout(1000, (s) => {
      signal = s;
      return new Promise<void>((resolve) =>
        s.addEventListener("abort", () => resolve()),
      );
    });
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await p;
    expect(signal?.aborted).toBe(true);
  });

  it("propagates errors and clears the timer", async () => {
    vi.useFakeTimers();
    await expect(
      withTimeout(1000, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(vi.getTimerCount()).toBe(0);
  });
});
