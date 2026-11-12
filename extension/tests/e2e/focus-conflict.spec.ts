import { expect, shot, test } from "./fixtures";

test("focus toggle: conflict offer scrolls into view and takes focus", async ({
  context,
  extensionId,
  signIn,
  seed,
}) => {
  await signIn();
  const now = Date.now();
  const titles = ["Fix the login bug", "Clean up the inbox", "Draft the plan"];
  await seed({
    calendarConnected: true,
    calendar: {
      fetchedAt: now,
      events: [
        {
          id: "e1",
          title: "Team sync",
          start: now + 15 * 60_000,
          end: now + 45 * 60_000,
          allDay: false,
        },
      ],
    },
    tasks: titles.map((title, i) => ({
      id: `t${i}`,
      title,
      steps: [
        { id: `s${i}a`, title: "First step", done: false },
        { id: `s${i}b`, title: "Second step", done: false },
      ],
      createdAt: now - (i + 1) * 60_000,
      doneAt: null,
    })),
  });
  const p = await context.newPage();
  await p.setViewportSize({ width: 380, height: 600 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  await p.getByRole("checkbox", { name: "Focus mode" }).click();
  const shorten = p.getByRole("button", { name: /Shorten to end before/ });
  await expect(shorten).toBeFocused();
  await expect(
    p.getByRole("alert", { name: "Calendar conflict with Team sync" }),
  ).toBeVisible();
  const box = await shorten.boundingBox();
  const vh = p.viewportSize()?.height ?? 0;
  if (!box) throw new Error("no bounding box");
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vh);
  await shot(p, "focus-conflict");
});
