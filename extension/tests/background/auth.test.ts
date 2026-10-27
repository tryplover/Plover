import { fakeBrowser } from "wxt/testing/fake-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: sb }),
}));

import type { Command } from "@/lib/messages";
import { registerAuthHandlers } from "@/background/auth";
import { dispatch } from "@/background/controller";
import { registerTimerHandlers } from "@/background/timer";
import { getLocal, setLocal } from "@/lib/storage";

const REDIRECT = "https://abc.chromiumapp.org/";
const launchWebAuthFlow = vi.fn();

async function signedIn(on: boolean) {
  await fakeBrowser.storage.local.remove("sb-x-auth-token");
  if (on) await fakeBrowser.storage.local.set({ "sb-x-auth-token": "{}" });
  await setLocal({ needsSignIn: !on });
}

beforeEach(async () => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_700_000_000_000);
  Object.values(sb).forEach((m) => m.mockReset());
  launchWebAuthFlow.mockReset();
  Object.assign(fakeBrowser.identity, {
    launchWebAuthFlow,
    getRedirectURL: () => REDIRECT,
  });
  registerAuthHandlers();
  registerTimerHandlers();
  await signedIn(false);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("auth/google", () => {
  it("runs the PKCE flow and clears needsSignIn", async () => {
    await setLocal({ needsSignIn: true });
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT}?code=CODE`);
    sb.exchangeCodeForSession.mockResolvedValue({ error: null });

    const r = await dispatch({ type: "auth/google" });

    expect(r.ok).toBe(true);
    expect(sb.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    expect(launchWebAuthFlow).toHaveBeenCalledWith({
      url: "https://sb.example/authorize",
      interactive: true,
    });
    expect(sb.exchangeCodeForSession).toHaveBeenCalledWith("CODE");
    expect(await getLocal("needsSignIn")).toBe(false);
  });

  it("fails when the redirect has no code", async () => {
    await setLocal({ needsSignIn: true });
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT}?error=access_denied`);

    const r = await dispatch({ type: "auth/google" });

    expect(r.ok).toBe(false);
    expect(sb.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(await getLocal("needsSignIn")).toBe(true);
  });

  it("fails when the user cancels the flow", async () => {
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    launchWebAuthFlow.mockResolvedValue(undefined);
    expect((await dispatch({ type: "auth/google" })).ok).toBe(false);
  });

  it("fails when launchWebAuthFlow rejects", async () => {
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    launchWebAuthFlow.mockRejectedValue(new Error("user closed window"));
    expect(await dispatch({ type: "auth/google" })).toEqual({
      ok: false,
      error: "user closed window",
    });
  });

  it("does not block the queue while the interactive flow is pending", async () => {
    await signedIn(true);
    await dispatch({ type: "timer/start" });
    const before = await getLocal("timer");
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    let finish: (v: string) => void = () => undefined;
    launchWebAuthFlow.mockReturnValue(
      new Promise<string>((r) => {
        finish = r;
      }),
    );
    sb.exchangeCodeForSession.mockResolvedValue({ error: null });
    const pending = dispatch({ type: "auth/google" });
    await vi.waitFor(() => expect(launchWebAuthFlow).toHaveBeenCalled());

    vi.setSystemTime(before.phaseEndsAt + 1);
    await fakeBrowser.alarms.onAlarm.trigger({
      name: "timer-phase",
      scheduledTime: before.phaseEndsAt,
      persistAcrossSessions: false,
    });
    expect((await getLocal("timer")).phase).not.toBe("work");

    finish(`${REDIRECT}?code=CODE`);
    expect((await pending).ok).toBe(true);
  });

  it("surfaces exchange errors", async () => {
    sb.signInWithOAuth.mockResolvedValue({
      data: { url: "https://sb.example/authorize" },
      error: null,
    });
    launchWebAuthFlow.mockResolvedValue(`${REDIRECT}?code=CODE`);
    sb.exchangeCodeForSession.mockResolvedValue({
      error: { message: "bad code" },
    });
    expect(await dispatch({ type: "auth/google" })).toEqual({
      ok: false,
      error: "bad code",
    });
  });
});

describe("auth/password", () => {
  it("signIn maps to signInWithPassword and clears needsSignIn", async () => {
    await setLocal({ needsSignIn: true });
    sb.signInWithPassword.mockResolvedValue({ error: null });
    const r = await dispatch({
      type: "auth/password",
      mode: "signIn",
      email: "a@b.co",
      password: "pw",
    });
    expect(r.ok).toBe(true);
    expect(sb.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.co",
      password: "pw",
    });
    expect(await getLocal("needsSignIn")).toBe(false);
  });

  it("signIn error is returned", async () => {
    sb.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    expect(
      await dispatch({
        type: "auth/password",
        mode: "signIn",
        email: "a@b.co",
        password: "x",
      }),
    ).toEqual({ ok: false, error: "Invalid login credentials" });
  });

  it("signUp with a session is signed in", async () => {
    sb.signUp.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });
    const r = await dispatch({
      type: "auth/password",
      mode: "signUp",
      email: "a@b.co",
      password: "pw",
    });
    expect(sb.signUp).toHaveBeenCalledWith({ email: "a@b.co", password: "pw" });
    expect(r).toEqual({ ok: true });
    expect(await getLocal("needsSignIn")).toBe(false);
  });

  it("signUp without a session asks to confirm email", async () => {
    await setLocal({ needsSignIn: true });
    sb.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const r = await dispatch({
      type: "auth/password",
      mode: "signUp",
      email: "a@b.co",
      password: "pw",
    });
    expect(r).toEqual({ ok: true, data: { confirmEmail: true } });
    expect(await getLocal("needsSignIn")).toBe(true);
  });
});

describe("auth/signOut", () => {
  it("signs out and leaves a running timer alone", async () => {
    await signedIn(true);
    await dispatch({ type: "timer/start" });
    sb.signOut.mockResolvedValue({ error: null });
    const r = await dispatch({ type: "auth/signOut" });
    expect(r.ok).toBe(true);
    expect(sb.signOut).toHaveBeenCalled();
    expect((await getLocal("timer")).phase).toBe("work");
    expect(await getLocal("needsSignIn")).toBe(true);
  });

  it("clears the local session and succeeds even if supabase signOut throws", async () => {
    await signedIn(true);
    sb.signOut.mockRejectedValue(new Error("offline"));
    const r = await dispatch({ type: "auth/signOut" });
    expect(r.ok).toBe(true);
    expect(await getLocal("needsSignIn")).toBe(true);
    expect(
      (await fakeBrowser.storage.local.get("sb-x-auth-token"))[
        "sb-x-auth-token"
      ],
    ).toBeUndefined();
  });
});

describe("sign-in gate", () => {
  it("blocks timer/start when signed out", async () => {
    const r = await dispatch({ type: "timer/start" });
    expect(r).toEqual({ ok: false, error: "not signed in" });
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("lets timer/stop through when signed out so a running session ends", async () => {
    await signedIn(true);
    await dispatch({ type: "timer/start" });
    await signedIn(false);
    const r = await dispatch({ type: "timer/stop" });
    expect(r.ok).toBe(true);
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("lets pause/resume/skip through when signed out", async () => {
    await signedIn(true);
    await dispatch({ type: "timer/start" });
    await signedIn(false);
    expect((await dispatch({ type: "timer/pause" })).ok).toBe(true);
    expect((await dispatch({ type: "timer/resume" })).ok).toBe(true);
  });

  it.each([
    { type: "focus/set", on: true },
    { type: "blocking/set", on: true },
    { type: "task/decompose", text: "x" },
    { type: "task/save", task: { id: "t" } },
    { type: "calendar/connect" },
  ] as unknown as Command[])("blocks $type when signed out", async (cmd) => {
    await setLocal({ needsSignIn: false });
    expect(await dispatch(cmd)).toEqual({ ok: false, error: "not signed in" });
    expect(await getLocal("needsSignIn")).toBe(true);
  });

  it.each([
    { type: "focus/set", on: false },
    { type: "blocking/set", on: false },
  ] as const)("lets $type off through when signed out", async (cmd) => {
    await setLocal({ needsSignIn: false });
    expect(await dispatch(cmd)).not.toEqual({
      ok: false,
      error: "not signed in",
    });
    expect(await getLocal("needsSignIn")).toBe(false);
  });

  it("allows timer/start with a stored session even if refresh would fail", async () => {
    await signedIn(true);
    sb.getSession.mockRejectedValue(new Error("offline"));
    expect((await dispatch({ type: "timer/start" })).ok).toBe(true);
  });

  it("refuses when a session is stored but needsSignIn is true", async () => {
    await signedIn(true);
    await setLocal({ needsSignIn: true });
    expect((await dispatch({ type: "timer/start" })).ok).toBe(false);
  });
});

describe("auth network calls run outside the queue", () => {
  async function queueStillMoves() {
    await signedIn(true);
    await dispatch({ type: "timer/start" });
    expect((await dispatch({ type: "timer/pause" })).ok).toBe(true);
  }

  it("auth/password does not hold the queue while supabase is pending", async () => {
    let finish: (v: { error: null }) => void = () => undefined;
    sb.signInWithPassword.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    const pending = dispatch({
      type: "auth/password",
      mode: "signIn",
      email: "a@b.co",
      password: "pw",
    });
    await vi.waitFor(() => expect(sb.signInWithPassword).toHaveBeenCalled());
    await queueStillMoves();
    finish({ error: null });
    expect((await pending).ok).toBe(true);
    expect(await getLocal("needsSignIn")).toBe(false);
  });

  it("auth/signOut does not hold the queue while supabase is pending", async () => {
    let finish: (v: { error: null }) => void = () => undefined;
    sb.signOut.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    await signedIn(true);
    const pending = dispatch({ type: "auth/signOut" });
    await vi.waitFor(() => expect(sb.signOut).toHaveBeenCalled());
    await dispatch({ type: "timer/start" });
    expect((await dispatch({ type: "timer/pause" })).ok).toBe(true);
    finish({ error: null });
    expect((await pending).ok).toBe(true);
    expect(await getLocal("needsSignIn")).toBe(true);
  });
});
