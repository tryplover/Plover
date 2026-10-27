import { reconcileCalendar } from "./calendar";
import { reconcileFocus } from "./focus";
import { enqueue } from "./queue";
import { reconcileTimer } from "./timer";

export async function reconcile(): Promise<void> {
  await enqueue(async () => {
    await reconcileTimer();
    await reconcileFocus();
  });
  await reconcileCalendar();
}
