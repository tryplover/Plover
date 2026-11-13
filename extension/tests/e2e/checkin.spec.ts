import { expect, shot, test } from "./fixtures";

test("check-in replaces the step list and keeps the timer controls above the fold", async ({
  context,
  extensionId,
  signIn,
  seed,
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
        ],
        createdAt: now - 60_000,
        doneAt: null,
        parked: null,
        lastActiveAt: now - 60_000,
      },
    ],
    activeTaskId: "t1",
    timer: {
      phase: "shortBreak",
      phaseEndsAt: now + 5 * 60_000,
      blocksCompleted: 1,
      pausedAt: null,
    },
    phaseStartedAt: now,
    cycleId: "c1",
    transient: {
      checkInPending: true,
      checkInTaskId: "t1",
      nudgeText: null,
      nudgeUntil: 0,
      celebrateUntil: 0,
      extendOffer: false,
    },
  });
  const p = await context.newPage();
  await p.setViewportSize({ width: 380, height: 600 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(
    p.getByRole("heading", { name: "Which step did you finish?" }),
  ).toBeVisible();
  await expect(p.getByText("Reproduce it")).toHaveCount(1);
  await expect(p.getByText("Write a failing test")).toHaveCount(1);
  await expect(p.getByRole("checkbox", { name: "Reproduce it" })).toHaveCount(
    0,
  );
  await expect(p.getByRole("button", { name: "Mark task done" })).toHaveCount(
    0,
  );
  await expect(
    p.getByRole("heading", { name: "Fix the login bug" }),
  ).toBeVisible();

  const pause = p.getByRole("button", { name: "Pause" });
  const box = await pause.boundingBox();
  if (!box) throw new Error("no bounding box");
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(600);
  await shot(p, "checkin-single-list");

  await p.getByRole("button", { name: "Reproduce it" }).focus();
  await p.keyboard.press("Space");
  await expect(
    p.getByRole("heading", { name: "Which step did you finish?" }),
  ).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Pause" })).toBeFocused();
  await expect(p.locator(".plover-sr")).toHaveText(
    "Reproduce it done. Next: Write a failing test.",
  );
  await expect(p.getByRole("checkbox", { name: "Reproduce it" })).toBeChecked();
  await expect(p.getByRole("button", { name: "Mark task done" })).toBeVisible();
});

test("idle check-in: focus lands on the task box and a later start is not yanked", async ({
  context,
  extensionId,
  signIn,
  seed,
}) => {
  await signIn();
  const now = Date.now();
  await seed({
    tasks: [
      {
        id: "t1",
        title: "Fix the login bug",
        steps: [{ id: "s1", title: "Reproduce it", done: false }],
        createdAt: now - 60_000,
        doneAt: null,
        parked: null,
        lastActiveAt: now - 60_000,
      },
    ],
    activeTaskId: null,
    transient: {
      checkInPending: true,
      checkInTaskId: "t1",
      nudgeText: null,
      nudgeUntil: 0,
      celebrateUntil: 0,
      extendOffer: false,
    },
  });
  const p = await context.newPage();
  await p.setViewportSize({ width: 380, height: 600 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(
    p.getByRole("heading", { name: "Which step did you finish?" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "None yet" }).focus();
  await p.keyboard.press("Space");
  await expect(
    p.getByRole("heading", { name: "Which step did you finish?" }),
  ).toHaveCount(0);
  await expect(
    p.getByRole("textbox", { name: "What are you working on?" }),
  ).toBeFocused();
  await expect(p.locator(".plover-sr")).toHaveText("Check-in skipped.");

  await p.getByRole("button", { name: "Resume Fix the login bug" }).click();
  await expect(p.getByRole("button", { name: "Pause" })).toBeFocused();
});
