import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { ALL_SITES } from "@/features/site-access/origins";
import { PRIVACY_POLICY_URL } from "@/shared/links";
import { SignIn } from "@/ui/components/SignIn";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
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

function Welcome() {
  const { local, ready } = useExtensionState();
  if (!ready) return null;

  return (
    <main className="welcome">
      <h1>Welcome to Plover</h1>

      <section>
        <h2>Sign in</h2>
        {local.needsSignIn ? <SignIn /> : <p>Signed in.</p>}
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

      <section>
        <h2>Site access</h2>
        <SiteAccess />
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Welcome />);
}
