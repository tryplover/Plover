import { expect, shot, test } from "./fixtures";

test("popup: start, pause, skip, mark done, undo", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  const title = "Write the intro of my history essay";
  const p = await context.newPage();
  await p.setViewportSize({ width: 420, height: 720 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  await p
    .getByPlaceholder("e.g. Write the intro of my essay")
    .pressSequentially(title);
  await p.getByRole("button", { name: "Write my own" }).click();
  for (const s of ["Outline three points", "Draft the hook"]) {
    await p.getByRole("button", { name: "Add step" }).click();
    await p.locator('input[aria-label^="Step "]').last().fill(s);
  }
  await shot(p, "popup-1-steps");
  await p.getByRole("button", { name: "Start" }).click();
  await expect(p.getByText("Focus block")).toBeVisible();
  await expect(p.getByText(title).first()).toBeVisible();
  await shot(p, "popup-2-running");

  await p.getByRole("button", { name: "Pause" }).click();
  await expect(p.getByRole("button", { name: "Resume" }).first()).toBeVisible();
  await p.getByRole("button", { name: "Resume" }).first().click();
  await p.getByRole("button", { name: "Skip" }).click();
  await expect(p.getByText("Short break")).toBeVisible();
  await shot(p, "popup-3-break");
  await p.getByRole("button", { name: "Skip" }).click();

  await p.getByRole("button", { name: "Mark task done" }).click();
  await expect(p.getByText(`Done: “${title}”`)).toBeVisible();
  await expect(p.getByRole("button", { name: "Undo" }).first()).toBeVisible();
  await shot(p, "popup-4-done");

  const local = await serviceWorker.evaluate(() =>
    chrome.storage.local.get(["sessions", "tasks"]),
  );
  const sessions = local.sessions as {
    phase: string;
    completed: boolean;
  }[];
  expect(sessions.some((x) => x.phase === "work" && !x.completed)).toBe(true);
  const tasks = local.tasks as { doneAt: number | null }[];
  expect(tasks.some((t) => t.doneAt)).toBe(true);

  await p.getByRole("button", { name: "Undo" }).first().click();
  await expect(p.getByText("Your tasks")).toBeVisible();
  await expect(p.getByText(title).first()).toBeVisible();
});
