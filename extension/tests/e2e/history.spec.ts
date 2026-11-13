import { expect, shot, test } from "./fixtures";
import { seedHistory } from "./seed";

test("history: seeded tasks, steps, clear confirm", async ({
  context,
  extensionId,
  signIn,
  seed,
}) => {
  await signIn();
  await seed(seedHistory(Date.now()));
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/task-history.html`);
  await expect(
    p.getByText(/\d+ tasks finished · \d+ focus blocks/),
  ).toBeVisible();
  await p.getByRole("tab", { name: /Tasks/ }).click();
  await expect(p.getByText("Fix the login bug").first()).toBeVisible();
  const inProgress = p.getByRole("region", { name: "In progress" });
  await expect(inProgress).toBeVisible();
  await expect(inProgress.getByText("Plan next week")).toBeVisible();
  await expect(
    inProgress.getByText("0 of 1 steps · 2 blocks · 1 h 4 m so far"),
  ).toBeVisible();
  await shot(p, "history-1-list");

  await p.getByRole("textbox", { name: "Search tasks" }).fill("plan next");
  await expect(inProgress.getByText("Plan next week")).toBeVisible();
  await expect(p.getByText("Fix the login bug")).toHaveCount(0);
  await p.getByRole("textbox", { name: "Search tasks" }).fill("login");
  await expect(inProgress).toHaveCount(0);
  await expect(p.getByText("Fix the login bug").first()).toBeVisible();
  await p.getByRole("textbox", { name: "Search tasks" }).fill("");

  await p.getByRole("button", { name: /Steps/ }).first().click();
  await expect(p.locator(".history-steps").first()).toBeVisible();
  await shot(p, "history-2-steps");

  await p.getByRole("button", { name: "Clear history" }).click();
  await expect(p.getByRole("button", { name: "Cancel" })).toBeVisible();
  await shot(p, "history-3-clear-confirm");
  await p.getByRole("button", { name: "Cancel" }).click();
  await expect(p.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Clear history" })).toBeVisible();
});

test("history: reachable and consistent with focus time but no finished task", async ({
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
        id: "open-1",
        title: "Plan next week",
        steps: [{ id: "o1", title: "List deadlines", done: false }],
        createdAt: now - 3600000,
        doneAt: null,
        parked: null,
        lastActiveAt: now - 3600000,
      },
    ],
    sessions: [
      {
        id: "s0",
        taskId: "open-1",
        phase: "work",
        startedAt: now - 30 * 60000,
        endedAt: now - 5 * 60000,
        completed: true,
        cycleId: "c0",
        pausedMs: 0,
        taskTitle: "Plan next week",
      },
    ],
  });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole("button", { name: "History" })).toBeVisible();

  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/task-history.html`);
  await expect(
    p.getByText("0 tasks finished · 1 focus block · 25 m focused"),
  ).toBeVisible();
  await p.getByText("All time", { exact: true }).click();
  await expect(
    p.locator(".stat-tile", { hasText: "Focus time" }),
  ).toContainText("25 m");
  await expect(p.locator(".stat-tile", { hasText: "Pomodoros" })).toContainText(
    "1",
  );
});

test("history: tabs move with arrow keys, Home and End as one Tab stop", async ({
  context,
  extensionId,
  signIn,
  seed,
}) => {
  await signIn();
  await seed(seedHistory(Date.now()));
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/task-history.html`);
  const tablist = p.getByRole("tablist", { name: "History view" });
  const stats = p.getByRole("tab", { name: "Stats", exact: true });
  const tasks = p.getByRole("tab", { name: "Tasks", exact: true });
  await expect(tablist).toBeVisible();

  await stats.focus();
  await p.keyboard.press("ArrowRight");
  await expect(tasks).toBeFocused();
  await expect(tasks).toHaveAttribute("aria-selected", "true");
  await expect(p.getByText("Fix the login bug").first()).toBeVisible();

  await p.keyboard.press("ArrowRight");
  await expect(stats).toBeFocused();
  await expect(stats).toHaveAttribute("aria-selected", "true");

  await p.keyboard.press("ArrowLeft");
  await expect(tasks).toBeFocused();
  await expect(tasks).toHaveAttribute("aria-selected", "true");

  await p.keyboard.press("Home");
  await expect(stats).toBeFocused();
  await expect(stats).toHaveAttribute("aria-selected", "true");

  await p.keyboard.press("End");
  await expect(tasks).toBeFocused();
  await expect(tasks).toHaveAttribute("aria-selected", "true");

  await p.keyboard.press("Home");
  await expect(stats).toBeFocused();
  await p.keyboard.press("Tab");
  await expect(tasks).not.toBeFocused();
  await expect(tasks).toHaveAttribute("tabindex", "-1");
  await expect(stats).toHaveAttribute("tabindex", "0");
  await expect(p.locator("#history-panel")).toHaveAttribute(
    "aria-labelledby",
    "tab-stats",
  );
});
