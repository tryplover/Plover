import { useEffect, useState, useCallback } from 'react';
import { ActivityRow } from '../components/ActivityRow.js';
import { ACTIVITY_KINDS } from '@shared/activity-kinds.js';

interface Row { id: number; ts: string; kind: string; payload: Record<string, unknown> }
const KINDS_DEFAULT: string[] = [];
const PAGE_SIZE = 100;

export function Activity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kinds, setKinds] = useState<string[]>(KINDS_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (currentCount: number, reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : currentCount;
    const next = await window.api.listActivity({
      kinds: kinds.length ? kinds : undefined,
      limit: PAGE_SIZE,
      offset,
    });
    setRows((prev) => (reset ? next : [...prev, ...next]));
    setDone(next.length < PAGE_SIZE);
    setLoading(false);
  }, [kinds]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(0, true); }, [load]);

  const deleteRow = async (id: number): Promise<void> => {
    await window.api.purgeActivity({ ids: [id] });
    setRows((r) => r.filter((row) => row.id !== id));
  };

  return (
    <div className="activity-page">
      <header>
        <h1>Activity</h1>
        <KindFilter kinds={kinds} onChange={setKinds} />
      </header>
      <ul className="activity-list">
        {rows.map((r) => (
          <ActivityRow key={r.id} row={r} onDelete={() => deleteRow(r.id)} />
        ))}
      </ul>
      {!done && (
        <button onClick={() => void load(rows.length, false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
      {done && rows.length === 0 && <p className="empty">No activity yet.</p>}
    </div>
  );
}

function KindFilter({ kinds, onChange }: { kinds: string[]; onChange: (k: string[]) => void }) {
  const ALL = ACTIVITY_KINDS.map((k) => k.kind);
  return (
    <div className="kind-filter">
      {ACTIVITY_KINDS.map((k) => (
        <label key={k.kind}>
          <input
            type="checkbox"
            checked={kinds.length === 0 || kinds.includes(k.kind)}
            onChange={(e) => {
              if (e.target.checked) {
                const next = [...kinds.filter((x) => x !== k.kind), k.kind];
                onChange(next.length === ALL.length ? [] : next);
              } else {
                onChange(kinds.length ? kinds.filter((x) => x !== k.kind) : ALL.filter((x) => x !== k.kind));
              }
            }}
          />
          {k.label}
        </label>
      ))}
    </div>
  );
}
