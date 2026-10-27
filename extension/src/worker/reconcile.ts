import { reconcileCalendar } from "@/features/calendar/worker";
import { reconcileFocus } from "@/features/focus/worker";
import { enqueue } from "@/worker/queue";
import { reconcileTimer } from "@/features/timer/worker";

export async function reconcile(): Promise<void> {
  await enqueue(async () => {
    await reconcileTimer();
    await reconcileFocus();
  });
  await reconcileCalendar();
}
