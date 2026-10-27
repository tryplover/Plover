import { getAccessToken } from "@/lib/auth/session";

const MAX_STEPS = 12;
const TIMEOUT_MS = 15_000;

export class DecomposeError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const aborted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () =>
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
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new DecomposeError(`decompose failed: ${res.status}`, res.status);
    }
    const json = (await res.json()) as {
      subtasks?: { title?: unknown }[];
    };
    const subtasks = Array.isArray(json.subtasks) ? json.subtasks : [];
    return subtasks
      .map((s) => (typeof s?.title === "string" ? s.title.trim() : ""))
      .filter((t) => t.length > 0)
      .slice(0, MAX_STEPS);
  } finally {
    clearTimeout(timer);
  }
}
