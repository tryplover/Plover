import { expect, shot, test } from "./fixtures";

const BUDDY = { x: 1280 - 16 - 32, y: 720 - 16 - 35 };

test("panel grows to show the timer controls of a running block", async ({
  context,
  signIn,
  seed,
  testPage,
}) => {
  await signIn();
  const now = Date.now();
  await seed({
    tasks: [
      {
        id: "t1",
        title: "Fix the login bug",
        steps: [
          { id: "s1", title: "Reproduce it", done: false },
          { id: "s2", title: "Write a failing test", done: false },
          { id: "s3", title: "Patch the token refresh", done: false },
          { id: "s4", title: "Ship it", done: false },
        ],
        createdAt: now - 60_000,
        doneAt: null,
        parked: null,
        lastActiveAt: now - 60_000,
      },
    ],
    activeTaskId: "t1",
    timer: {
      phase: "work",
      phaseEndsAt: now + 25 * 60_000,
      blocksCompleted: 0,
      pausedAt: null,
    },
    phaseStartedAt: now,
    cycleId: "c1",
  });
  const p = await context.newPage();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.goto(testPage);
  await expect(p.locator("plover-buddy")).toBeAttached({ timeout: 15_000 });
  await p.waitForTimeout(1000);
  await p.mouse.click(BUDDY.x, BUDDY.y);
  const iframe = p.locator('iframe[src*="panel.html"]');
  await expect(iframe).toBeVisible();
  const pause = iframe.contentFrame().getByRole("button", { name: "Pause" });
  await expect(pause).toBeVisible();
  await expect(pause).toBeInViewport({ ratio: 1 });
  await shot(p, "panel-height-running");
});

test("panel is shorter than its default when the content is short", async ({
  context,
  signIn,
  testPage,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.setViewportSize({ width: 1280, height: 1200 });
  await p.goto(testPage);
  await expect(p.locator("plover-buddy")).toBeAttached({ timeout: 15_000 });
  await p.waitForTimeout(1000);
  await p.mouse.click(1280 - 16 - 32, 1200 - 16 - 35);
  const iframe = p.locator('iframe[src*="panel.html"]');
  await expect(iframe).toBeVisible();
  await expect
    .poll(async () => (await iframe.boundingBox())?.height ?? 480)
    .toBeLessThan(480);
});
