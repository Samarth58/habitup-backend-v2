import React from 'react';

export function DailyUsageChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        No daily usage data available for this period.
      </div>
    );
  }

  const maxSessions = Math.max(...data.map((d) => d.sessions || 0), 1);

  return (
    <div>
      <div className="chart-bar-container">
        {data.map((item, idx) => {
          const heightPercent = Math.round(((item.sessions || 0) / maxSessions) * 100);
          return (
            <div key={idx} className="chart-bar-col">
              <div
                className="chart-bar"
                style={{ height: `${Math.max(heightPercent, 5)}%` }}
                title={`${item.date}: ${item.sessions} sessions (${item.active_users} active users)`}
              ></div>
              <span className="chart-label">{item.date?.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ActivityDistribution({ byType = {} }) {
  const entries = Object.entries(byType);
  const total = entries.reduce((acc, [_, count]) => acc + count, 0);

  if (total === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        No activity distribution data available.
      </div>
    );
  }

  const colorPalette = [
    '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {entries.map(([type, count], idx) => {
        const percent = Math.round((count / total) * 100);
        const color = colorPalette[idx % colorPalette.length];
        return (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{type}</span>
              <span style={{ color: 'var(--text-muted)' }}>{count} ({percent}%)</span>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${percent}%`, background: color }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
