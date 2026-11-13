import { expect, shot, test } from "./fixtures";

test("popup: start, pause, skip, mark done, undo", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  const title = "Write the intro of my history essay";
  const p = await context.newPage();
  await p.setViewportSize({ width: 420, height: 720 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  const input = p.getByRole("textbox", { name: "What are you working on?" });
  await expect(input).toBeVisible();
  await expect(p.getByRole("status")).toHaveCount(1);
  await input.pressSequentially(title);
  await p.getByRole("button", { name: "Write my own" }).click();
  await expect(p.getByRole("textbox", { name: "Step 1" })).toBeFocused();
  await p.getByRole("textbox", { name: "Step 1" }).fill("Outline three points");
  await p.getByRole("button", { name: "Add step" }).click();
  await p.locator('input[aria-label^="Step "]').last().fill("Draft the hook");
  await expect(p.getByRole("button", { name: "Move step 2 up" })).toBeVisible();
  await expect(
    p.getByRole("button", { name: "Delete step 2: Draft the hook" }),
  ).toBeVisible();
  await shot(p, "popup-1-steps");
  await p.getByRole("button", { name: "Start" }).click();
  await expect(p.getByText("Focus block", { exact: true })).toBeVisible();
  await expect(p.getByRole("button", { name: "Pause" })).toBeFocused();
  await expect(p.getByRole("status").first()).toHaveText("Focus block started");
  await expect(p.getByRole("heading", { name: title })).toBeVisible();
  await expect(p.getByText(title).first()).toBeVisible();
  await shot(p, "popup-2-running");

  await p.getByRole("button", { name: "Pause" }).click();
  await expect(p.getByRole("button", { name: "Resume" }).first()).toBeVisible();
  await p.getByRole("button", { name: "Resume" }).first().click();
  await p.waitForTimeout(1100);
  await p.getByRole("button", { name: "Skip" }).click();
  await expect(p.getByText("Short break", { exact: true })).toBeVisible();
  await shot(p, "popup-3-break");
  await p.getByRole("button", { name: "Skip" }).click();

  await p.getByRole("button", { name: "Mark task done" }).click();
  await expect(p.getByText(`Done: “${title}”`)).toBeVisible();
  await expect(p.getByRole("button", { name: "Undo" }).first()).toBeVisible();
  await shot(p, "popup-4-done");

  const local = await serviceWorker.evaluate(() =>
    chrome.storage.local.get(["sessions", "tasks"]),
  );
  const sessions = local.sessions as {
    phase: string;
    completed: boolean;
  }[];
  expect(sessions.some((x) => x.phase === "work" && !x.completed)).toBe(true);
  const tasks = local.tasks as { doneAt: number | null }[];
  expect(tasks.some((t) => t.doneAt)).toBe(true);

  await p.getByRole("button", { name: "Undo" }).first().click();
  await expect(p.getByText("Your tasks")).toBeVisible();
  await expect(p.getByText(title).first()).toBeVisible();
  await expect(
    p.getByRole("button", { name: `Resume ${title}` }),
  ).toBeFocused();
  await expect(p.locator(".plover-sr")).toHaveText(`Restored “${title}”.`);
});

test("popup: add to list without starting", async ({
  context,
  extensionId,
  serviceWorker,
  signIn,
}) => {
  await signIn();
  const title = "Plan the science fair project";
  const p = await context.newPage();
  await p.setViewportSize({ width: 420, height: 720 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  await p
    .getByRole("textbox", { name: "What are you working on?" })
    .pressSequentially(title);
  await p.getByRole("button", { name: "Write my own" }).click();
  await p.getByRole("textbox", { name: "Step 1" }).fill("Pick a topic");
  await p.getByRole("button", { name: "Add step" }).click();
  await p.locator('input[aria-label^="Step "]').last().fill("List materials");
  await p.getByRole("button", { name: "Add to list" }).click();

  await expect(p.getByText("Your tasks")).toBeVisible();
  await expect(p.getByText(title).first()).toBeVisible();
  await expect(p.getByText("Focus block", { exact: true })).toHaveCount(0);
  await expect(
    p.getByRole("textbox", { name: "What are you working on?" }),
  ).toHaveValue("");

  const local = await serviceWorker.evaluate(() =>
    chrome.storage.local.get(["tasks", "activeTaskId", "timer"]),
  );
  const tasks = local.tasks as {
    title: string;
    doneAt: number | null;
    parked?: unknown;
  }[];
  const saved = tasks.find((t) => t.title === title);
  expect(saved?.doneAt).toBeNull();
  expect(saved?.parked).toBeUndefined();
  expect(local.activeTaskId ?? null).toBeNull();
  expect((local.timer as { phase: string }).phase).toBe("idle");
});

test("popup: repeated Undo of the same task is announced each time", async ({
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
        id: "t1",
        title: "Plan the science fair project",
        steps: [],
        createdAt: now - 60_000,
        doneAt: null,
        parked: null,
        lastActiveAt: now - 60_000,
      },
    ],
  });
  const p = await context.newPage();
  await p.setViewportSize({ width: 420, height: 720 });
  await p.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(p.getByText("Your tasks")).toBeVisible();
  const status = p.locator(".plover-sr");
  const message = "Restored “Plan the science fair project”.";
  await p.evaluate(() => {
    const w = window as unknown as { seen: string[] };
    w.seen = [];
    new MutationObserver(() =>
      w.seen.push(document.querySelector(".plover-sr")?.textContent ?? ""),
    ).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  for (let i = 0; i < 2; i++) {
    await p
      .getByRole("button", {
        name: "More actions for Plan the science fair project",
      })
      .click();
    await p.getByRole("button", { name: "Delete" }).click();
    await p.getByRole("button", { name: "Undo" }).click();
    await expect(status).toHaveText(message);
    await expect(
      p.getByRole("button", { name: "Resume Plan the science fair project" }),
    ).toBeFocused();
  }
  const seen = await p.evaluate(
    () => (window as unknown as { seen: string[] }).seen,
  );
  const changes = seen.filter((t, i) => t !== seen[i - 1]);
  expect(changes.filter((t) => t === message)).toHaveLength(2);
  expect(changes).toContain("");
});
