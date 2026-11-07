import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";
import { PRIVACY_POLICY_URL } from "@/shared/links";
import { sendCommand } from "@/shared/messages";
import { Buddy } from "@/ui/components/Buddy";
import { SignIn } from "@/ui/components/SignIn";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./welcome.css";

function SiteAccess() {
  const [granted, setGranted] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void browser.permissions.contains({ origins: [ALL_SITES] }).then((ok) => {
        if (alive) setGranted(ok);
      });
    };
    refresh();
    browser.permissions.onAdded.addListener(refresh);
    browser.permissions.onRemoved.addListener(refresh);
    return () => {
      alive = false;
      browser.permissions.onAdded.removeListener(refresh);
      browser.permissions.onRemoved.removeListener(refresh);
    };
  }, []);

  if (granted) {
    return (
      <p>
        Plover is on your pages. You can change this in chrome://extensions any
        time.
      </p>
    );
  }

  return (
    <>
      <p>
        The buddy floats in a corner of each page. It only draws itself and
        reads nothing on the page.
      </p>
      <button
        type="button"
        onClick={() =>
          void browser.permissions
            .request({ origins: [ALL_SITES] })
            .then((ok) => setDeclined(!ok))
        }
      >
        Let Plover hang out on your pages
      </button>
      {declined && (
        <p role="status">
          No problem. The Plover popup can add it one site at a time.
        </p>
      )}
    </>
  );
}

function CalendarConnect({
  connected,
  needsSignIn,
}: {
  connected: boolean;
  needsSignIn: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const result = await sendCommand({ type: "calendar/connect" });
    if (!result.ok) setError(result.error);
  }

  if (connected) return <p>Calendar connected.</p>;

  return (
    <>
      <button
        type="button"
        disabled={needsSignIn}
        onClick={() => void connect()}
      >
        Connect
      </button>
      {needsSignIn && <p>Sign in first.</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function Welcome() {
  const { local, ready } = useExtensionState();
  if (!ready) return null;

  return (
    <main className="welcome">
      <header className="welcome-header">
        <div className="welcome-buddy">
          <Buddy state="idle" />
        </div>
        <h1>Welcome to Plover</h1>
        <p>Plover is a small work buddy for your browser.</p>
      </header>

      <section>
        <h2>Sign in</h2>
        {local.needsSignIn ? <SignIn /> : <p>Signed in.</p>}
      </section>

      <section>
        <h2>What Plover does</h2>
        <ul className="welcome-list">
          <li>
            Break a task into steps. Plover suggests them and you can edit every
            one.
          </li>
          <li>
            Run a Pomodoro timer. At the end of each work block, tick off the
            step you finished.
          </li>
          <li>
            Turn on Focus mode to block your distracting sites until the block
            ends.
          </li>
          <li>
            The buddy sits in a corner of the sites you allow, and never reads
            the page.
          </li>
        </ul>
      </section>

      <section>
        <h2>Site access</h2>
        <SiteAccess />
      </section>

      <section>
        <h2>Google Calendar (optional)</h2>
        <p>
          See your next event so a focus block doesn&apos;t run into a meeting.
          Plover only reads your calendar.
        </p>
        <CalendarConnect
          connected={local.calendarConnected}
          needsSignIn={local.needsSignIn}
        />
      </section>

      <section>
        <h2>Pin Plover</h2>
        <p>
          Click the puzzle-piece icon in Chrome&apos;s toolbar, then the pin
          next to Plover. You can also press Alt+Shift+P to open it.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          Your tasks stay on this device. Plover does not read the pages you
          visit or your browsing history.
        </p>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
          Read the privacy policy
        </a>
      </section>
    </main>
  );
}

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Welcome />);
}
