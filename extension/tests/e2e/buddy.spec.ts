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

test("buddy: stays above a page's fixed elements", async ({
  context,
  signIn,
  testPage,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.setViewportSize({ width: 1100, height: 800 });
  await p.goto(testPage);
  await expect(p.locator("plover-buddy")).toBeAttached({ timeout: 15_000 });
  await p.evaluate(() => {
    const cover = document.createElement("div");
    cover.id = "page-widget";
    cover.style.cssText =
      "position:fixed;right:0;bottom:0;width:200px;height:200px;z-index:10;background:#0a7";
    document.body.append(cover);
  });
  await p.waitForTimeout(500);
  const x = 1100 - 16 - 32;
  const y = 800 - 16 - 35;
  expect(
    await p.evaluate(
      ({ px, py }) => document.elementFromPoint(px, py)?.tagName,
      { px: x, py: y },
    ),
  ).toBe("PLOVER-BUDDY");
  await p.mouse.click(x, y);
  await expect(p.locator('iframe[src*="panel.html"]')).toBeVisible();
  await shot(p, "buddy-3-above-fixed");
});

test("buddy: Escape and a click outside close the panel", async ({
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
  const panel = p.locator('iframe[src*="panel.html"]');
  const buddy = { x: 1100 - 16 - 32, y: 800 - 16 - 35 };

  await p.mouse.click(buddy.x, buddy.y);
  await expect(panel).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await p.mouse.click(buddy.x, buddy.y);
  await expect(panel).toBeVisible();
  await p.mouse.click(100, 100);
  await expect(panel).toBeHidden();

  await p.mouse.click(buddy.x, buddy.y);
  await expect(panel).toBeVisible();
  await panel.contentFrame().locator("body").click();
  await p.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
