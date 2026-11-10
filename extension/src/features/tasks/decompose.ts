import { getAccessToken } from "@/features/auth/session";
import { withTimeout } from "@/shared/with-timeout";

const MAX_STEPS = 12;
const TIMEOUT_MS = 15_000;

export class DecomposeError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
  }
}

async function dailyLimitRetry(res: Response): Promise<number | null> {
  if (res.status !== 429) return null;
  try {
    const body = (await res.json()) as {
      error?: unknown;
      retryAfterSeconds?: unknown;
    };
    if (body.error !== "daily rate limit exceeded") return null;
    return typeof body.retryAfterSeconds === "number"
      ? body.retryAfterSeconds
      : 0;
  } catch {
    return null;
  }
}

function backendUrl(): string {
  const url =
    (import.meta.env.WXT_PLOVER_BACKEND_URL as string | undefined) ?? "";
  return url.replace(/\/+$/, "");
}

export async function suggestSteps(
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  return withTimeout(TIMEOUT_MS, async (signal) => {
    const aborted = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () =>
        reject(new DecomposeError("decompose timed out", null)),
      );
    });
    const token = await Promise.race([getAccessToken(), aborted]);
    if (!token) throw new DecomposeError("not signed in", 401);
    const res = await fetchImpl(`${backendUrl()}/api/decompose`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        goalText: text,
        now: new Date().toISOString(),
      }),
      signal,
    });
    if (!res.ok) {
      throw new DecomposeError(
        `decompose failed: ${res.status}`,
        res.status,
        await dailyLimitRetry(res),
      );
    }
    const json = (await res.json()) as {
      subtasks?: { title?: unknown }[];
    };
    const subtasks = Array.isArray(json.subtasks) ? json.subtasks : [];
    return subtasks
      .map((s) => (typeof s?.title === "string" ? s.title.trim() : ""))
      .filter((t) => t.length > 0)
      .slice(0, MAX_STEPS);
  });
}

export function limitNotice(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const when =
    minutes <= 0
      ? "tomorrow"
      : minutes < 60
        ? `in about ${minutes} min`
        : `in about ${Math.ceil(minutes / 60)} h`;
  return `You've used today's step suggestions. Write your own below, or try again ${when}.`;
}
