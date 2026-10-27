import { beforeEach, describe, expect, it, vi } from "vitest";

const token = vi.hoisted(() => ({ value: "TOKEN" as string | null }));
vi.mock("@/lib/auth/session", () => ({
  getAccessToken: async () => token.value,
}));
import { DecomposeError, suggestSteps } from "@/lib/api/decompose";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  token.value = "TOKEN";
});

describe("suggestSteps", () => {
  it("sends the bearer token and goalText", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ goal: { title: "x" }, subtasks: [] }),
    );
    await suggestSteps("Write essay", fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url.endsWith("/api/decompose")).toBe(true);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer TOKEN",
    );
    const body = JSON.parse(init.body as string) as {
      goalText: string;
      now: string;
    };
    expect(body.goalText).toBe("Write essay");
    expect(Number.isNaN(Date.parse(body.now))).toBe(false);
  });

  it("returns trimmed non-empty titles, max 12", async () => {
    const f = async () =>
      jsonResponse({
        goal: { title: "x" },
        subtasks: [{ title: " A " }, { title: "" }, { title: "B" }],
      });
    expect(await suggestSteps("x", f as unknown as typeof fetch)).toEqual([
      "A",
      "B",
    ]);
    const many = async () =>
      jsonResponse({
        subtasks: Array.from({ length: 20 }, (_, i) => ({ title: `s${i}` })),
      });
    expect(
      await suggestSteps("x", many as unknown as typeof fetch),
    ).toHaveLength(12);
  });

  it("treats a missing token as a 401", async () => {
    token.value = null;
    const f = vi.fn();
    await expect(
      suggestSteps("x", f as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 401 });
    expect(f).not.toHaveBeenCalled();
  });

  it("throws DecomposeError with status on non-2xx", async () => {
    const f = async () => jsonResponse({}, 429);
    await expect(
      suggestSteps("x", f as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(DecomposeError);
  });
});
