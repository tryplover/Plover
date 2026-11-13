import { expect, shot, test } from "./fixtures";

test("settings: work block stepper", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const field = p.getByRole("textbox", { name: "Work block" });
  await field.fill("");
  await field.press("Enter");
  await expect(field).toHaveValue("1");
  await expect
    .poll(async () =>
      serviceWorker.evaluate(async () => {
        const { settings } = await chrome.storage.sync.get("settings");
        return (settings as { workMinutes?: number } | undefined)?.workMinutes;
      }),
    )
    .toBe(1);
  await p.getByRole("button", { name: "Increase work block" }).click();
  await expect(field).toHaveValue("2");
  await shot(p, "settings-1-work-block");
});

test("settings: site list names, focus and announcements", async ({
  context,
  extensionId,
  signIn,
}) => {
  await signIn();
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const input = p.getByRole("textbox", { name: "Blocked sites" });
  for (const site of ["youtube.com", "reddit.com"]) {
    await input.fill(site);
    await input.press("Enter");
    await expect(
      p.getByRole("button", { name: `Remove ${site}` }),
    ).toBeVisible();
  }
  await expect(p.getByRole("status").filter({ hasText: "Added" })).toHaveText(
    "Added reddit.com",
  );
  await shot(p, "settings-2-site-list");
  await p.getByRole("button", { name: "Remove youtube.com" }).click();
  await expect(
    p.getByRole("button", { name: "Remove reddit.com" }),
  ).toBeFocused();
  await expect(p.getByRole("status").filter({ hasText: "Removed" })).toHaveText(
    "Removed youtube.com",
  );
  await p.getByRole("button", { name: "Remove reddit.com" }).click();
  await expect(input).toBeFocused();
});

test("empty blocklist hint in the popup links to Settings and goes away", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 420, height: 720 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const hint = popup.getByText("No sites to block yet");
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText("No sites to block yet · Add sites");
  await shot(popup, "settings-3-empty-blocklist-hint");

  const opened = context.waitForEvent("page");
  await popup.getByRole("button", { name: "Add sites" }).click();
  const options = await opened;
  await expect(options).toHaveURL(/options\.html#blocked-sites$/);
  const input = options.getByRole("textbox", { name: "Blocked sites" });
  await expect(input).toBeFocused();
  await input.fill("youtube.com");
  await input.press("Enter");
  await expect(
    options.getByRole("button", { name: "Remove youtube.com" }),
  ).toBeVisible();

  await expect(hint).toBeHidden();
  await expect
    .poll(async () =>
      serviceWorker.evaluate(async () => {
        const { settings } = await chrome.storage.sync.get("settings");
        return (settings as { blocklist?: string[] } | undefined)?.blocklist;
      }),
    )
    .toEqual(["youtube.com"]);
});
