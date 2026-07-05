import { useState, useEffect, useCallback } from 'react';
import { useAppEvents } from '../../hooks/useAppEvents';
import { SummaryRow } from '../../../shared/types';
import { StatusIndicator } from '../../components/StatusIndicator';

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
  }, [fetchSummaries]);

  useAppEvents(
    useCallback(
      (appEvent) => {
        if (appEvent.type === 'summary.created' || appEvent.type === 'task.completed') {
          void fetchSummaries();
        }
      },
      [fetchSummaries],
    ),
  );

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
        paddingRight: '40px',
        backgroundColor: 'var(--plover-bg)',
      }}
    >
      <div style={{ marginBottom: '28px' }}>
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

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
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
            {summaries.map((summary, idx) => (
              <div key={summary.id} className="timeline-feed-item">
                <div
                  className={`timeline-feed-dot ${idx === 0 ? 'timeline-feed-dot--pulsing' : ''}`}
                />
                <div className="timeline-feed-card">
                  <div className="timeline-feed-header">
                    <div className="timeline-feed-meta">
                      <span className="timeline-feed-time">{formatTimestamp(summary.ts)}</span>
                      <div className="timeline-feed-tags">
                        {summary.goal_title && (
                          <span className="timeline-feed-tag-goal">{summary.goal_title}</span>
                        )}
                        {summary.task_title && (
                          <span className="timeline-feed-tag-task">{summary.task_title}</span>
                        )}
                      </div>
                    </div>
                    {summary.signal > 0 && (
                      <span className="timeline-feed-signal">
                        +{Math.round(summary.signal * 100)}% Progress
                      </span>
                    )}
                  </div>
                  <p className="timeline-feed-reasoning">“{summary.summary}”</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
