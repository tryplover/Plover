import { useState } from 'react';
import { ScreenshotPreview } from './ScreenshotPreview.js';

interface Row { id: number; ts: string; kind: string; payload: Record<string, unknown> }

export function ActivityRow({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={`activity-row activity-${row.kind}`}>
      <time>{new Date(row.ts).toLocaleString()}</time>
      <span className="kind">{row.kind}</span>
      <span className="summary">{summarize(row)}</span>
      {row.kind === 'screenshot_captured' && (
        <button onClick={() => setExpanded((v) => !v)}>{expanded ? 'Hide' : 'Show'}</button>
      )}
      <button className="delete" onClick={onDelete} aria-label="Delete">×</button>
      {expanded && row.kind === 'screenshot_captured' && <ScreenshotPreview id={row.id} />}
    </li>
  );
}

function summarize(row: Row): string {
  const p = row.payload as Record<string, unknown>;
  switch (row.kind) {
    case 'window_focus':        return `${String(p.app ?? '')} — ${String(p.title ?? '')}`;
    case 'gdocs_revision':      return `Edited "${String(p.name ?? '')}"`;
    case 'file_modified':       return `Modified ${String(p.path ?? '')}`;
    case 'file_added':          return `Added ${String(p.path ?? '')}`;
    case 'git_commit':          return `Commit ${String(p.hash ?? '').slice(0, 7)}: ${String(p.message ?? '').split('\n')[0]}`;
    case 'screenshot_captured': return `Screenshot ${String(p.width ?? '?')}×${String(p.height ?? '?')}`;
    case 'screenshot_inferred': return Number(p.confidence ?? 0) <= 0.3 ? '' : `Inferred: ${String(p.summary ?? '')}`;
    default:                    return JSON.stringify(p);
  }
}
