import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STATE_PORT,
  buildSnapshot,
  registerStatePort,
} from "@/background/state-port";
import { DEFAULT_LOCAL } from "@/lib/storage";

beforeEach(() => {
  fakeBrowser.reset();
});

describe("buildSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it("carries only the buddy state, nudge text and check-in flag", async () => {
    await fakeBrowser.storage.local.set({
      "sb-abc-auth-token": { access_token: "secret" },
      tasks: [
        {
          id: "t",
          title: "Write the essay",
          steps: [{ id: "s", title: "Outline", done: false }],
          createdAt: 0,
          doneAt: null,
        },
      ],
      calendar: {
        events: [
          { id: "e", title: "Dentist", start: 2e6, end: 3e6, allDay: false },
        ],
        fetchedAt: 0,
      },
    });
    const snap = await buildSnapshot();
    expect(snap).toEqual({
      buddyState: "idle",
      nudgeText: null,
      checkInPending: false,
    });
    const json = JSON.stringify(snap);
    for (const leaked of ["secret", "Write the essay", "Outline", "Dentist"])
      expect(json).not.toContain(leaked);
  });

  it("shows the nudge text only while the nudge window is open", async () => {
    await fakeBrowser.storage.local.set({
      transient: {
        ...DEFAULT_LOCAL.transient,
        nudgeText: "Still on it?",
        nudgeUntil: 1_000_500,
      },
    });
    expect(await buildSnapshot()).toEqual({
      buddyState: "nudging",
      nudgeText: "Still on it?",
      checkInPending: false,
    });
    vi.setSystemTime(1_000_500);
    expect((await buildSnapshot()).nudgeText).toBeNull();
  });

  it("flags a pending check-in", async () => {
    await fakeBrowser.storage.local.set({
      transient: { ...DEFAULT_LOCAL.transient, checkInPending: true },
    });
    expect(await buildSnapshot()).toEqual({
      buddyState: "nudging",
      nudgeText: null,
      checkInPending: true,
    });
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
    await fakeBrowser.storage.local.set({
      transient: { ...DEFAULT_LOCAL.transient, checkInPending: true },
    });
    await vi.waitFor(() => expect(posted).toHaveLength(2));
    expect(posted[1]).toEqual({
      buddyState: "nudging",
      nudgeText: null,
      checkInPending: true,
    });
  });

  it("re-posts when a nudge window expires so the blob calms down", async () => {
    await fakeBrowser.storage.local.set({
      transient: {
        ...DEFAULT_LOCAL.transient,
        nudgeText: "Still on it?",
        nudgeUntil: Date.now() + 300,
      },
    });
    registerStatePort();
    const { port, posted } = connect();
    onConnect(port as unknown as chrome.runtime.Port);
    await vi.waitFor(() => expect(posted).toHaveLength(1));
    expect((posted[0] as { buddyState: string }).buddyState).toBe("nudging");
    await vi.waitFor(() => expect(posted).toHaveLength(2), { timeout: 2000 });
    expect(posted[1]).toEqual({
      buddyState: "idle",
      nudgeText: null,
      checkInPending: false,
    });
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
