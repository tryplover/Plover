import { getLocal, setLocal } from "@/shared/storage";

export const NUDGE_VISIBLE_MS = 60_000;

// Read-modify-write of `transient`: call only from inside the command queue.
export async function showNudge(text: string, now = Date.now()): Promise<void> {
  const transient = await getLocal("transient");
  await setLocal({
    transient: {
      ...transient,
      nudgeText: text,
      nudgeUntil: now + NUDGE_VISIBLE_MS,
    },
  });
}
