import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STATE_PORT,
  buildSnapshot,
  registerStatePort,
} from "@/background/state-port";
import { DEFAULT_LOCAL, DEFAULT_SETTINGS } from "@/lib/storage";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("buildSnapshot", () => {
  it("returns defaults merged with stored values and never sb-* keys", async () => {
    await fakeBrowser.storage.local.set({
      blockingOn: true,
      "sb-abc-auth-token": { access_token: "secret" },
    });
    const snap = await buildSnapshot();
    expect(snap.local.blockingOn).toBe(true);
    expect(snap.local.tasks).toEqual(DEFAULT_LOCAL.tasks);
    expect(snap.settings).toEqual(DEFAULT_SETTINGS);
    expect(JSON.stringify(snap)).not.toContain("secret");
    expect(Object.keys(snap.local).sort()).toEqual(
      Object.keys(DEFAULT_LOCAL).sort(),
    );
  });
});

describe("registerStatePort", () => {
  let onConnect: (port: chrome.runtime.Port) => void;
  beforeEach(() => {
    vi.spyOn(fakeBrowser.runtime.onConnect, "addListener").mockImplementation(
      (fn) => void (onConnect = fn),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  function connect() {
    const posted: unknown[] = [];
    const port = {
      name: STATE_PORT,
      postMessage: vi.fn((m: unknown) => void posted.push(m)),
      onDisconnect: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    };
    return { port, posted };
  }

  it("posts a snapshot on connect and on every storage change", async () => {
    registerStatePort();
    const { port, posted } = connect();
    onConnect(port as unknown as chrome.runtime.Port);
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    await fakeBrowser.storage.local.set({ blockingOn: true });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(
      (posted[1] as { local: { blockingOn: boolean } }).local.blockingOn,
    ).toBe(true);
    await fakeBrowser.storage.sync.set({ settings: { workMinutes: 30 } });
    await vi.waitFor(() => expect(posted).toHaveLength(3));
    expect(
      (posted[2] as { settings: { workMinutes: number } }).settings.workMinutes,
    ).toBe(30);
  });

  it("ignores ports with other names", async () => {
    registerStatePort();
    const { port, posted } = connect();
    port.name = "other";
    onConnect(port as unknown as chrome.runtime.Port);
    await new Promise((r) => setTimeout(r, 10));
    expect(posted).toHaveLength(0);
  });
});
