import { fakeBrowser } from "wxt/testing/fake-browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { registerAuthHandlers } from "@/background/auth";
import { dispatch } from "@/background/controller";
import { registerTimerHandlers } from "@/background/timer";
import { getLocal, setLocal } from "@/lib/storage";

const REDIRECT = "https://abc.chromiumapp.org/";
const launchWebAuthFlow = vi.fn();

function signedIn(on: boolean) {
  sb.getSession.mockResolvedValue({
    data: { session: on ? { access_token: "tok" } : null },
  });
}

beforeEach(() => {
  fakeBrowser.reset();
  Object.values(sb).forEach((m) => m.mockReset());
  launchWebAuthFlow.mockReset();
  Object.assign(fakeBrowser.identity, {
    launchWebAuthFlow,
    getRedirectURL: () => REDIRECT,
  });
  registerAuthHandlers();
  registerTimerHandlers();
  signedIn(false);
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
    signedIn(true);
    await dispatch({ type: "timer/start" });
    sb.signOut.mockResolvedValue({ error: null });
    const r = await dispatch({ type: "auth/signOut" });
    expect(r.ok).toBe(true);
    expect(sb.signOut).toHaveBeenCalled();
    expect((await getLocal("timer")).phase).toBe("work");
  });
});

describe("sign-in gate", () => {
  it("blocks timer/start when signed out", async () => {
    const r = await dispatch({ type: "timer/start" });
    expect(r).toEqual({ ok: false, error: "not signed in" });
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("lets timer/stop through when signed out so a running session ends", async () => {
    signedIn(true);
    await dispatch({ type: "timer/start" });
    signedIn(false);
    const r = await dispatch({ type: "timer/stop" });
    expect(r.ok).toBe(true);
    expect((await getLocal("timer")).phase).toBe("idle");
  });

  it("lets pause/resume/skip through when signed out", async () => {
    signedIn(true);
    await dispatch({ type: "timer/start" });
    signedIn(false);
    expect((await dispatch({ type: "timer/pause" })).ok).toBe(true);
    expect((await dispatch({ type: "timer/resume" })).ok).toBe(true);
  });

  it.each([
    { type: "focus/set", on: true },
    { type: "blocking/set", on: true },
    { type: "task/decompose", text: "x" },
    { type: "calendar/connect" },
  ] as const)("blocks $type when signed out", async (cmd) => {
    expect(await dispatch(cmd)).toEqual({ ok: false, error: "not signed in" });
  });
});
