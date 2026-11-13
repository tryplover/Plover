import { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { siteFromInput } from "@/features/blocking/domains";
import { ALL_SITES, siteOrigin } from "@/features/site-access/origins";
import { sendCommand } from "@/shared/messages";
import { clampInput } from "@/shared/number-input";
import { updateSettings } from "@/shared/storage";
import type { Settings, Theme } from "@/shared/types";
import { useExtensionState } from "@/ui/hooks/useExtensionState";
import { useSiteAccess } from "@/ui/hooks/useSiteAccess";
import { applyStoredTheme } from "@/ui/theme";
import "@/ui/base.css";
import "./options.css";

type NumberKey =
  | "workMinutes"
  | "shortBreakMinutes"
  | "longBreakMinutes"
  | "blocksPerLongBreak"
  | "focusNudgeMinutes";

const NUMBER_FIELDS: {
  key: NumberKey;
  label: string;
  unit: string;
  max: number;
}[] = [
  { key: "workMinutes", label: "Work block", unit: "min", max: 90 },
  { key: "shortBreakMinutes", label: "Short break", unit: "min", max: 30 },
  { key: "longBreakMinutes", label: "Long break", unit: "min", max: 60 },
  {
    key: "blocksPerLongBreak",
    label: "Blocks before a long break",
    unit: "",
    max: 10,
  },
  {
    key: "focusNudgeMinutes",
    label: "Focus nudge every",
    unit: "min",
    max: 60,
  },
];

function Stepper({
  label,
  unit,
  value,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();
  const commit = (raw: string) => {
    setDraft(null);
    const n = clampInput(raw, 1, max);
    if (n !== value) onChange(n);
  };
  return (
    <div className="stepper-row">
      <label htmlFor={id}>{label}</label>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          −
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const step = e.key === "ArrowUp" ? 1 : -1;
              onChange(clampInput(String(value + step), 1, max));
            }
          }}
        />
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
        <span className="stepper-unit" aria-hidden={!unit}>
          {unit}
        </span>
      </div>
    </div>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function DomainList({
  id,
  title,
  items,
  onChange,
  onAdd,
}: {
  id?: string;
  title: string;
  items: string[];
  onChange: (next: string[]) => void;
  onAdd?: (domain: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusAfter = useRef<{ domain: string | null } | null>(null);

  useEffect(() => {
    if (id && location.hash === `#${id}`) {
      inputRef.current?.scrollIntoView({ block: "center" });
      inputRef.current?.focus();
    }
  }, [id]);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    const next = target.domain ? removeRefs.current.get(target.domain) : null;
    (next ?? inputRef.current)?.focus();
  }, [items]);

  function remove(i: number) {
    const domain = items[i];
    if (domain === undefined) return;
    focusAfter.current = { domain: items[i + 1] ?? items[i - 1] ?? null };
    setAnnouncement(`Removed ${domain}`);
    onChange(items.filter((x) => x !== domain));
  }

  function add() {
    const domain = siteFromInput(draft);
    if (!domain) {
      setError("Enter a site like youtube or example.com");
      return;
    }
    setError(null);
    setDraft("");
    onAdd?.(domain);
    if (items.includes(domain)) {
      setAnnouncement(`${domain} is already on the list`);
    } else {
      setAnnouncement(`Added ${domain}`);
      onChange([...items, domain]);
    }
  }

  return (
    <section>
      <h2>{title}</h2>
      <div className="row">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          aria-label={title}
          placeholder="youtube or example.com"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button type="button" onClick={add}>
          Add
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="plover-sr" role="status" aria-live="polite">
        {announcement}
      </p>
      <ul className="domain-list">
        {items.map((d, i) => (
          <li key={d}>
            <span>{d}</span>
            <button
              ref={(el) => {
                if (el) removeRefs.current.set(d, el);
                else removeRefs.current.delete(d);
              }}
              type="button"
              className="plover-btn-text"
              aria-label={`Remove ${d}`}
              onClick={() => remove(i)}
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
  const allSites = useSiteAccess();
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
        <h2>Appearance</h2>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {THEMES.map(({ value, label }) => (
            <label key={value} className="segment">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={settings.theme === value}
                onChange={() => save({ theme: value })}
              />
              {label}
            </label>
          ))}
        </div>
        {settings.theme === "system" && (
          <p className="hint">Matches your computer&apos;s setting.</p>
        )}
      </section>

      <section>
        <h2>Timer</h2>
        <div className="stepper-list">
          {NUMBER_FIELDS.map(({ key, label, unit, max }) => (
            <Stepper
              key={key}
              label={label}
              unit={unit}
              value={settings[key]}
              max={max}
              onChange={(n) => save({ [key]: n })}
            />
          ))}
        </div>
      </section>

      <DomainList
        id="blocked-sites"
        title="Blocked sites"
        items={settings.blocklist}
        onChange={(blocklist) => save({ blocklist })}
        onAdd={(d) =>
          void browser.permissions.request({ origins: [siteOrigin(d)] })
        }
      />

      <section>
        <h2>Where Plover appears</h2>
        <div className="field">
          <span id="all-sites-label">Show Plover on all sites</span>
          <button
            type="button"
            role="switch"
            aria-checked={allSites}
            aria-labelledby="all-sites-label"
            className="switch"
            onClick={() =>
              void (allSites
                ? browser.permissions.remove({ origins: [ALL_SITES] })
                : browser.permissions.request({ origins: [ALL_SITES] }))
            }
          />
        </div>
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
          Open Plover with Alt+Shift+O. To change it, go to
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

applyStoredTheme();
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Options />);
}
