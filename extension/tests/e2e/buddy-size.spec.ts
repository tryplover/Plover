import { expect, shot, test } from "./fixtures";

const W = 1100;
const H = 800;
const MARGIN = 16;
const SIZES = {
  small: { width: 48, height: 53 },
  medium: { width: 64, height: 70 },
  large: { width: 88, height: 96 },
} as const;

for (const [size, dims] of Object.entries(SIZES)) {
  for (const corner of ["bottom-right", "top-left"] as const) {
    test(`buddy size: ${size} in ${corner} draws and anchors the panel clear of the bird`, async ({
      context,
      serviceWorker,
      signIn,
      testPage,
    }) => {
      await signIn();
      await serviceWorker.evaluate(
        (s) =>
          chrome.storage.sync.set({
            settings: { buddySize: s.size, buddyCorner: s.corner },
          }),
        { size, corner },
      );
      const p = await context.newPage();
      await p.setViewportSize({ width: W, height: H });
      await p.goto(testPage);
      await expect(p.locator("plover-buddy")).toBeAttached({
        timeout: 15_000,
      });
      await p.waitForTimeout(1000);

      const bottom = corner.startsWith("bottom");
      const cx = bottom ? W - MARGIN - dims.width / 2 : MARGIN + dims.width / 2;
      const cy = bottom
        ? H - MARGIN - dims.height / 2
        : MARGIN + dims.height / 2;
      const birdEdge = bottom ? H - MARGIN - dims.height : MARGIN + dims.height;

      const hit = (x: number, y: number) =>
        p.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.tagName, {
          px: x,
          py: y,
        });
      expect(await hit(cx, cy)).toBe("PLOVER-BUDDY");
      const outside = bottom ? birdEdge - 6 : birdEdge + 6;
      expect(await hit(cx, outside)).not.toBe("PLOVER-BUDDY");
      await shot(p, `size-${size}-${corner}-1`);

      await p.mouse.click(cx, cy);
      const panel = p.locator('iframe[src*="panel.html"]');
      await expect(panel).toBeVisible();
      await p.waitForTimeout(500);
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        if (bottom) expect(box.y + box.height).toBeLessThan(birdEdge);
        else expect(box.y).toBeGreaterThan(birdEdge);
      }
      await shot(p, `size-${size}-${corner}-2-panel`);
    });
  }
}

test("buddy size: changing the setting resizes the buddy live", async ({
  context,
  serviceWorker,
  signIn,
  testPage,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.setViewportSize({ width: W, height: H });
  await p.goto(testPage);
  await expect(p.locator("plover-buddy")).toBeAttached({ timeout: 15_000 });
  await p.waitForTimeout(1000);

  const probe = { x: W - MARGIN - 80, y: H - MARGIN - 85 };
  const tag = () =>
    p.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.tagName, {
      px: probe.x,
      py: probe.y,
    });
  expect(await tag()).not.toBe("PLOVER-BUDDY");

  await serviceWorker.evaluate(() =>
    chrome.storage.sync.set({ settings: { buddySize: "large" } }),
  );
  await expect.poll(tag).toBe("PLOVER-BUDDY");
  await shot(p, "size-live-large");
});
