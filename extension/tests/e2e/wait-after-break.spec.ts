import { expect, test } from "./fixtures";

const READY = "Ready for the next block?";

test.describe("after a break", () => {
  test.beforeEach(async ({ signIn, seed, serviceWorker }) => {
    await signIn();
    const now = Date.now();
    await seed({
      timer: {
        phase: "shortBreak",
        phaseEndsAt: now + 3000,
        blocksCompleted: 1,
        pausedAt: null,
      },
      phaseStartedAt: now - 5 * 60_000,
      cycleId: "c1",
    });
    await serviceWorker.evaluate(
      (when) => chrome.alarms.create("timer-phase", { when }),
      now + 3000,
    );
  });

  test("waits for Start by default, then counts", async ({
    context,
    extensionId,
  }) => {
    const p = await context.newPage();
    await p.setViewportSize({ width: 380, height: 600 });
    await p.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(p.getByText("Short break", { exact: true })).toBeVisible();

    await expect(p.getByText(READY)).toBeVisible({ timeout: 10_000 });
    const start = p.getByRole("button", { name: "Start" });
    await expect(start).toBeVisible();
    await expect(p.getByRole("button", { name: "Skip" })).toHaveCount(0);
    await expect(p.getByText("25:00")).toBeVisible();
    await p.waitForTimeout(2200);
    await expect(p.getByText("25:00")).toBeVisible();

    await start.click();
    await expect(p.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(p.getByText(READY)).toHaveCount(0);
    await expect(p.getByText("24:5")).toBeVisible({ timeout: 5000 });
  });

  test("starts by itself when the setting is on and the check-in is answered", async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    await serviceWorker.evaluate(() =>
      chrome.storage.sync.set({ settings: { autoStartWork: true } }),
    );
    const p = await context.newPage();
    await p.setViewportSize({ width: 380, height: 600 });
    await p.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(p.getByText("Focus block", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(p.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(p.getByText(READY)).toHaveCount(0);
  });
});
