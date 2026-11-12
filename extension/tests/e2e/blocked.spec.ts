import { expect, shot, test } from "./fixtures";

const target = "https://news.example.com/docs/page?x=1";

test("blocked page: names the site, then offers to continue", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  await serviceWorker.evaluate(() =>
    chrome.storage.local.set({
      blockingOn: true,
      focus: { on: false, startedAt: null },
    }),
  );
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/blocked.html#${target}`);
  await expect(p.getByText("news.example.com", { exact: true })).toBeVisible();
  await expect(p.getByRole("link", { name: /Continue to/ })).toHaveCount(0);
  await shot(p, "blocked-1-site");
  await serviceWorker.evaluate(() =>
    chrome.storage.local.set({ blockingOn: false }),
  );
  const link = p.getByRole("link", { name: "Continue to news.example.com" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", target);
  await shot(p, "blocked-2-continue");
});
