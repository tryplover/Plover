import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function tabToBuddy(p: Page): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press("Tab");
    const onHost = await p.evaluate(
      () => document.activeElement?.tagName === "PLOVER-BUDDY",
    );
    if (onHost) return;
  }
  throw new Error("Tab never reached the buddy");
}

test("buddy: Tab reaches it, Enter and Space open, Escape closes", async ({
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

  await tabToBuddy(p);
  await p.keyboard.press("Enter");
  await expect(panel).toBeVisible();

  await p.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect
    .poll(() => p.evaluate(() => document.activeElement?.tagName))
    .toBe("PLOVER-BUDDY");

  await p.keyboard.press("Space");
  await expect(panel).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("buddy: a mouse click toggles once and a drag never opens", async ({
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
  const x = 1100 - 16 - 32;
  const y = 800 - 16 - 35;

  await p.mouse.click(x, y);
  await expect(panel).toBeVisible();
  await p.waitForTimeout(500);
  await expect(panel).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await p.mouse.move(x, y);
  await p.mouse.down();
  await p.mouse.move(100, 100, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(500);
  await expect(panel).toBeHidden();

  await p.mouse.click(16 + 32, 16 + 35);
  await expect(panel).toBeVisible();
});
