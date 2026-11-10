import { test as base, chromium } from "@playwright/test";
import type { BrowserContext, Page, Worker } from "@playwright/test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const BUILD_DIR = path.resolve(process.cwd(), ".output/chrome-mv3");
const SCREENS_DIR = path.resolve(process.cwd(), "tests/e2e/.screens");

function prepareExtensionCopy(): string {
  if (!fs.existsSync(path.join(BUILD_DIR, "manifest.json"))) {
    throw new Error(
      `Missing ${BUILD_DIR}: run pnpm build first, then pnpm e2e.`,
    );
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plover-e2e-"));
  fs.cpSync(BUILD_DIR, dir, { recursive: true });
  const manifestPath = path.join(dir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.host_permissions = ["<all_urls>"];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

export async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENS_DIR, `${name}.png`) });
}

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  signIn: () => Promise<void>;
  seed: (data: Record<string, unknown>) => Promise<void>;
  testPage: string;
}

interface WorkerFixtures {
  extensionDir: string;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  extensionDir: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const dir = prepareExtensionCopy();
      await use(dir);
      fs.rmSync(dir, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],
  context: async ({ extensionDir }, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      acceptDownloads: true,
      viewport: { width: 1100, height: 800 },
      ...(process.env.PW_CHROMIUM_PATH && {
        executablePath: process.env.PW_CHROMIUM_PATH,
      }),
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");
    await sw.evaluate(() => chrome.storage.local.get(null));
    await use(sw);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  signIn: async ({ serviceWorker }, use) => {
    await use(async () => {
      await serviceWorker.evaluate(() =>
        chrome.storage.local.set({
          needsSignIn: false,
          "sb-e2e-auth-token": '{"access_token":"x"}',
        }),
      );
    });
  },
  seed: async ({ serviceWorker }, use) => {
    await use(async (data) => {
      await serviceWorker.evaluate((d) => chrome.storage.local.set(d), data);
    });
  },
  // eslint-disable-next-line no-empty-pattern
  testPage: async ({}, use) => {
    const server = http.createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        "<!doctype html><title>Test page</title><body style='font-family:sans-serif'><h1>Plover test page</h1><p>Nothing to see here.</p></body>",
      );
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    await use(`http://127.0.0.1:${port}/`);
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  },
});

export { expect } from "@playwright/test";
