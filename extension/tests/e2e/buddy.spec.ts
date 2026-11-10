import { expect, shot, test } from "./fixtures";

test("buddy: draws on a page and opens the panel", async ({
  context,
  signIn,
  testPage,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.setViewportSize({ width: 1100, height: 800 });
  await p.goto(testPage);
  await expect(p.locator("plover-buddy")).toBeAttached({ timeout: 15_000 });
  await p.waitForTimeout(1000);
  await shot(p, "buddy-1-page");
  await p.mouse.click(1100 - 16 - 32, 800 - 16 - 35);
  await expect(p.locator('iframe[src*="panel.html"]')).toBeVisible();
  await shot(p, "buddy-2-panel");
});
