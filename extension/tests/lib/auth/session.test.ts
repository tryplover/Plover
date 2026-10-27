import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { getSession } })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { getAccessToken, isSignedIn } from "@/lib/auth/session";
import { getSupabase, storageAdapter } from "@/lib/auth/supabase";

beforeEach(() => {
  fakeBrowser.reset();
  getSession.mockReset();
});

describe("storageAdapter", () => {
  it("round-trips through browser.storage.local", async () => {
    expect(await storageAdapter.getItem("k")).toBeNull();
    await storageAdapter.setItem("k", "v");
    expect(await storageAdapter.getItem("k")).toBe("v");
    expect((await fakeBrowser.storage.local.get("k"))["k"]).toBe("v");
    await storageAdapter.removeItem("k");
    expect(await storageAdapter.getItem("k")).toBeNull();
  });
});

describe("getSupabase", () => {
  it("creates one client lazily with extension-safe options", () => {
    const a = getSupabase();
    expect(getSupabase()).toBe(a);
    expect(createClient).toHaveBeenCalledTimes(1);
    const calls = createClient.mock.calls as unknown as unknown[][];
    expect(calls[0]?.[2]).toMatchObject({
      auth: {
        storage: storageAdapter,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  });
});

describe("getAccessToken / isSignedIn", () => {
  it("returns the session access token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    expect(await getAccessToken()).toBe("tok");
    expect(await isSignedIn()).toBe(true);
  });

  it("returns null when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await getAccessToken()).toBeNull();
    expect(await isSignedIn()).toBe(false);
  });

  it("returns null when getSession throws", async () => {
    getSession.mockRejectedValue(new Error("offline"));
    expect(await getAccessToken()).toBeNull();
  });
});
