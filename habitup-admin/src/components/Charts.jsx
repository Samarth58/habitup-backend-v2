import React from 'react';

export function DailyUsageChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No daily usage data recorded for this timeframe.
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
                style={{ height: `${Math.max(heightPercent, 6)}%` }}
                title={`${item.date}: ${item.sessions} sessions (${item.active_users} active users)`}
              ></div>
              <span className="chart-label">{item.date?.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
        <span>Sessions per Day</span>
        <span>Dates (MM-DD)</span>
      </div>
    </div>
  );
}

export function ActivityDistribution({ byType = {} }) {
  const entries = Object.entries(byType);
  const total = entries.reduce((acc, [_, count]) => acc + count, 0);

  if (total === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No activity distribution events recorded.
      </div>
    );
  }

  const colorPalette = [
    '#4f46e5', // Indigo
    '#059669', // Emerald
    '#d97706', // Amber
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#2563eb', // Blue
    '#0d9488', // Teal
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {entries.map(([type, count], idx) => {
        const percent = Math.round((count / total) * 100);
        const color = colorPalette[idx % colorPalette.length];
        return (
          <div key={type}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{type}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{count} ({percent}%)</span>
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
