import { useState, type FormEvent } from "react";
import { sendCommand, type CommandResult } from "@/shared/messages";

export function SignIn() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<CommandResult>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    let result: CommandResult;
    try {
      result = await action();
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      setBusy(false);
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const data = result.data as { confirmEmail?: boolean } | undefined;
    if (data?.confirmEmail)
      setNotice("Check your email to confirm your account.");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(() =>
      sendCommand({ type: "auth/password", mode, email, password }),
    );
  }

  return (
    <div className="signin">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(() => sendCommand({ type: "auth/google" }))}
      >
        Continue with Google
      </button>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={busy}>
          {mode === "signIn" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
      >
        {mode === "signIn" ? "Create an account" : "Have an account? Sign in"}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
