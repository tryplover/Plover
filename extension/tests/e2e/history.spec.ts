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
  await expect(p.getByText(/\d+ tasks · \d+ focus blocks/)).toBeVisible();
  await expect(p.getByText("Fix the login bug").first()).toBeVisible();
  await expect(p.getByText("Plan next week")).toHaveCount(0);
  await shot(p, "history-1-list");

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
