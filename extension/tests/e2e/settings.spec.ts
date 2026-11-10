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
