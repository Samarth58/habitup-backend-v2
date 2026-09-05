import React from 'react';

export function KPICard({ title, value, icon, badgeText, badgeType = 'info', note, colorBg }) {
  return (
    <div className="glass-card kpi-card fade-in">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        <div
          className="kpi-icon"
          style={{ background: colorBg || 'var(--accent-primary-light)' }}
        >
          {icon}
        </div>
      </div>

      <div className="kpi-value">{value ?? '—'}</div>

      {(badgeText || note) && (
        <div className="kpi-footer">
          {badgeText && (
            <span className={`badge-tag badge-${badgeType}`}>{badgeText}</span>
          )}
          {note && <span>{note}</span>}
        </div>
      )}
    </div>
  );
}
