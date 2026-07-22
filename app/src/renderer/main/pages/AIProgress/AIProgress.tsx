import { useState, useEffect, useCallback, useMemo } from 'react';
import { SummaryRow } from '../../../../shared/types';
import { StatusIndicator } from '../../../components/StatusIndicator/StatusIndicator.js';

interface AIProgressProps {
  'data-testid'?: string;
}

type JoinedSummary = SummaryRow & {
  task_title: string | null;
  goal_title: string | null;
};

export default function AIProgress({ 'data-testid': dataTestId }: AIProgressProps) {
  const [summaries, setSummaries] = useState<JoinedSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummaries = useCallback(async () => {
    try {
      const data = await window.api.getSummaries();
      setSummaries(data);
    } catch (err) {
      console.error('Failed to load AI progress summaries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSummaries();

    const unsubscribe = window.api.on('app-event', (event: unknown) => {
      const appEvent = event as { type: string };
      if (appEvent.type === 'summary.created' || appEvent.type === 'task.completed') {
        void fetchSummaries();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchSummaries]);

  const groupedPasses = useMemo(() => {
    const byTs = new Map<string, JoinedSummary[]>();
    for (const s of summaries) {
      const arr = byTs.get(s.ts);
      if (arr) arr.push(s);
      else byTs.set(s.ts, [s]);
    }
    return Array.from(byTs.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ts, entries]) => ({
        ts,
        hits: entries.filter((e) => e.signal > 0),
      }));
  }, [summaries]);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();

      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) {
        return `Today at ${timeString}`;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = yesterday.toDateString() === date.toDateString();
      if (isYesterday) {
        return `Yesterday at ${timeString}`;
      }

      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeString}`;
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div
        data-testid={dataTestId}
        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div
      data-testid={dataTestId}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingTop: '40px',
        paddingBottom: '40px',
        paddingLeft: '40px',
        paddingRight: '0px',
        backgroundColor: 'var(--plover-bg)',
      }}
    >
      <div style={{ marginBottom: '28px', paddingRight: '40px' }}>
        <h1
          style={{
            fontFamily: 'var(--plover-font-serif)',
            fontSize: '36px',
            fontWeight: 400,
            color: 'var(--plover-text)',
            marginBottom: '6px',
          }}
        >
          AI Progress Insights
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--plover-text-muted)' }}>
          Real-time updates and evidence analyzed by Plover in the background.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '40px', paddingBottom: '24px' }}>
        {summaries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <StatusIndicator kind="not-sure" label="no insights yet" />
            <p style={{ fontSize: '14px', color: 'var(--plover-text-dim)', maxWidth: '320px' }}>
              Plover will automatically track your active window and write updates as you make
              progress on tasks.
            </p>
          </div>
        ) : (
          <div className="timeline-feed">
            {groupedPasses.map((pass, idx) => (
              <div key={pass.ts} className="timeline-feed-item">
                <div
                  className={`timeline-feed-dot ${idx === 0 ? 'timeline-feed-dot--pulsing' : ''}`}
                />
                <div className="timeline-feed-card">
                  <div className="timeline-feed-header">
                    <span className="timeline-feed-time">{formatTimestamp(pass.ts)}</span>
                  </div>
                  {pass.hits.length === 0 ? (
                    <p className="timeline-feed-empty">Pass ran — no evidence found</p>
                  ) : (
                    <div className="timeline-feed-hits">
                      {pass.hits.map((hit) => (
                        <div key={hit.id} className="timeline-feed-hit">
                          <div className="timeline-feed-hit-header">
                            <div className="timeline-feed-tags">
                              {hit.goal_title && (
                                <span className="timeline-feed-tag-goal">{hit.goal_title}</span>
                              )}
                              {hit.task_title && (
                                <span className="timeline-feed-tag-task">{hit.task_title}</span>
                              )}
                            </div>
                            <span className="timeline-feed-signal">
                              +{Math.round(hit.signal * 100)}% Progress
                            </span>
                          </div>
                          <p className="timeline-feed-reasoning">“{hit.summary}”</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
