import React from 'react';

export function KPICard({ title, value, icon, badgeText, badgeType = 'info', note }) {
  return (
    <div className="kpi-card fade-in">
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {icon && (
          <div className="kpi-icon" aria-hidden="true">
            {icon}
          </div>
        )}
      </div>

      <div className="kpi-value tabular-nums">{value ?? '—'}</div>

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
