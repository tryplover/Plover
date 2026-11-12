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
