import { useEffect, useState, useCallback } from 'react';
import { ActivityRow } from '../components/ActivityRow.js';

interface Row { id: number; ts: string; kind: string; payload: Record<string, unknown> }
const KINDS_DEFAULT: string[] = [];
const PAGE_SIZE = 100;

export function Activity() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kinds, setKinds] = useState<string[]>(KINDS_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    const offset = reset ? 0 : rows.length;
    const next = await window.api.listActivity({
      kinds: kinds.length ? kinds : undefined,
      limit: PAGE_SIZE,
      offset,
    });
    setRows(reset ? next : [...rows, ...next]);
    setDone(next.length < PAGE_SIZE);
    setLoading(false);
  }, [rows, kinds]);

  useEffect(() => { void load(true); }, [kinds]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

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
        <button onClick={() => void load(false)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
      {done && rows.length === 0 && <p className="empty">No activity yet.</p>}
    </div>
  );
}

function KindFilter({ kinds, onChange }: { kinds: string[]; onChange: (k: string[]) => void }) {
  const ALL = ['window_focus', 'gdocs_revision', 'file_modified', 'file_added', 'git_commit', 'screenshot_captured', 'screenshot_inferred'];
  return (
    <div className="kind-filter">
      {ALL.map((k) => (
        <label key={k}>
          <input
            type="checkbox"
            checked={kinds.length === 0 || kinds.includes(k)}
            onChange={(e) => {
              if (e.target.checked) onChange([...kinds.filter((x) => x !== k), k]);
              else onChange(kinds.length ? kinds.filter((x) => x !== k) : ALL.filter((x) => x !== k));
            }}
          />
          {k}
        </label>
      ))}
    </div>
  );
}
