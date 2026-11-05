import { useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { normalizeDomain } from "@/features/blocking/domains";
import { siteOrigin } from "@/features/site-access/origins";
import { sendCommand } from "@/shared/messages";
import { updateSettings } from "@/shared/storage";
import type { Settings } from "@/shared/types";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import "@/ui/base.css";
import "./options.css";

type NumberKey =
  | "workMinutes"
  | "shortBreakMinutes"
  | "longBreakMinutes"
  | "blocksPerLongBreak"
  | "focusNudgeMinutes";

const NUMBER_FIELDS: { key: NumberKey; label: string }[] = [
  { key: "workMinutes", label: "Work block (minutes)" },
  { key: "shortBreakMinutes", label: "Short break (minutes)" },
  { key: "longBreakMinutes", label: "Long break (minutes)" },
  { key: "blocksPerLongBreak", label: "Work blocks before a long break" },
  { key: "focusNudgeMinutes", label: "Focus nudge every (minutes)" },
];

function DomainList({
  title,
  items,
  onChange,
  onAdd,
}: {
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
  onAdd?: (domain: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const domain = normalizeDomain(draft);
    if (!domain) {
      setError("Enter a site like example.com");
      return;
    }
    setError(null);
    setDraft("");
    onAdd?.(domain);
    if (!items.includes(domain)) onChange([...items, domain]);
  }

  return (
    <section>
      <h2>{title}</h2>
      <div className="row">
        <input
          type="text"
          value={draft}
          aria-label={title}
          placeholder="example.com"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" onClick={add}>
          Add
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {items.map((d) => (
          <li key={d}>
            {d}{" "}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== d))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Options() {
  const { settings, local, ready } = useExtensionState();
  const [calendarError, setCalendarError] = useState<string | null>(null);
  if (!ready) return null;

  const save = (patch: Partial<Settings>) => void updateSettings(patch);

  async function toggleCalendar() {
    setCalendarError(null);
    const result = await sendCommand({
      type: local.calendarConnected
        ? "calendar/disconnect"
        : "calendar/connect",
    });
    if (!result.ok) setCalendarError(result.error);
  }

  return (
    <main className="options">
      <h1>Plover settings</h1>

      <section>
        <h2>Timer</h2>
        {NUMBER_FIELDS.map(({ key, label }) => (
          <label key={key} className="field">
            {label}
            <input
              type="number"
              min={1}
              value={settings[key]}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value));
                if (n >= 1) save({ [key]: n });
              }}
            />
          </label>
        ))}
      </section>

      <DomainList
        title="Blocked sites"
        items={settings.blocklist}
        onChange={(blocklist) => save({ blocklist })}
        onAdd={(d) =>
          void browser.permissions.request({ origins: [siteOrigin(d)] })
        }
      />

      <section>
        <h2>Buddy</h2>
        <label className="field">
          <input
            type="checkbox"
            checked={settings.hideEverywhere}
            onChange={(e) => save({ hideEverywhere: e.target.checked })}
          />
          Hide the buddy everywhere
        </label>
      </section>

      <DomainList
        title="Sites without the buddy"
        items={settings.hiddenSites}
        onChange={(hiddenSites) => save({ hiddenSites })}
      />

      <section>
        <h2>Google Calendar</h2>
        <p>
          {local.calendarConnected
            ? "Connected (read-only)."
            : "Not connected."}
        </p>
        <button type="button" onClick={() => void toggleCalendar()}>
          {local.calendarConnected ? "Disconnect" : "Connect"}
        </button>
        {calendarError && <p role="alert">{calendarError}</p>}
      </section>

      <section>
        <h2>Keyboard shortcut</h2>
        <p>
          Open Plover with Alt+Shift+P. To change it, go to
          chrome://extensions/shortcuts in your browser.
        </p>
      </section>

      <section>
        <h2>Account</h2>
        <button
          type="button"
          onClick={() => void sendCommand({ type: "auth/signOut" })}
        >
          Sign out
        </button>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Options />);
}
