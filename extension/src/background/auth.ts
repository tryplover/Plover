import { browser } from "wxt/browser";
import { getSupabase } from "@/lib/auth/supabase";
import type { CommandResult } from "@/lib/messages";
import { setLocal } from "@/lib/storage";
import { sessionKeys } from "@/lib/auth/session";
import { registerHandler } from "./controller";
import { enqueue } from "./queue";

function signedIn(): Promise<CommandResult> {
  return enqueue(async () => {
    await setLocal({ needsSignIn: false });
    return { ok: true };
  });
}

export function registerAuthHandlers(): void {
  registerHandler("auth/google", async () => {
    const redirectTo = browser.identity.getRedirectURL();
    const { data, error } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      return { ok: false, error: error?.message ?? "Could not start sign-in" };
    }
    const returned = await browser.identity.launchWebAuthFlow({
      url: data.url,
      interactive: true,
    });
    const code = returned ? new URL(returned).searchParams.get("code") : null;
    if (!code) return { ok: false, error: "Sign-in was cancelled" };
    const exchanged = await getSupabase().auth.exchangeCodeForSession(code);
    if (exchanged.error) return { ok: false, error: exchanged.error.message };
    return signedIn();
  });

  registerHandler("auth/password", async (cmd) => {
    const credentials = { email: cmd.email, password: cmd.password };
    if (cmd.mode === "signIn") {
      const { error } =
        await getSupabase().auth.signInWithPassword(credentials);
      return error ? { ok: false, error: error.message } : signedIn();
    }
    const { data, error } = await getSupabase().auth.signUp(credentials);
    if (error) return { ok: false, error: error.message };
    if (!data.session) return { ok: true, data: { confirmEmail: true } };
    return signedIn();
  });

  registerHandler("auth/signOut", async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* offline: local session is cleared below regardless */
    }
    return enqueue(async () => {
      await browser.storage.local.remove(await sessionKeys());
      await setLocal({ needsSignIn: true });
      return { ok: true };
    });
  });
}
