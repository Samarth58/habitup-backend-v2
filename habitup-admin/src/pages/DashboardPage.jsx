import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { KPICard } from '../components/KPICard';

export function DashboardPage() {
  const [period, setPeriod] = useState('7d');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = (selectedPeriod) => {
    setLoading(true);
    setError('');

    api.getDashboardMetrics(selectedPeriod)
      .then((data) => setMetrics(data))
      .catch((err) => setError(err.message || 'Failed to fetch dashboard metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMetrics(period);
  }, [period]);

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '—';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${sec % 60}s`;
  };

  return (
    <div className="content-container">
      {/* Top Filter Bar */}
      <div className="toolbar">
        <div className="toolbar-heading">
          <h2 className="toolbar-title">System Overview</h2>
          <p className="toolbar-subtitle">
            High-level metrics across users, habits, check-ins, and session usage
          </p>
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Period:</label>
          <select
            className="select-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="365d">Last 365 Days</option>
          </select>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading dashboard metrics...
        </div>
      ) : metrics ? (
        <div>
          {/* Main KPI Grid */}
          <div className="stats-grid">
            <KPICard
              title="TOTAL REGISTERED USERS"
              value={metrics.users?.total}
              icon="👥"
              badgeText={`+${metrics.users?.new_in_period || 0} New`}
              badgeType="success"
              colorBg="var(--accent-primary-light)"
            />

            <KPICard
              title="ACTIVE USERS IN PERIOD"
              value={metrics.users?.active_in_period}
              icon="🔥"
              badgeText={`${metrics.users?.deleted_in_period || 0} Deleted`}
              badgeType="warning"
              colorBg="var(--accent-warning-light)"
            />

            <KPICard
              title="TOTAL HABITS CREATED"
              value={metrics.habits?.total}
              icon="🎯"
              badgeText={`+${metrics.habits?.created_in_period || 0} in Period`}
              badgeType="info"
              colorBg="var(--accent-info-light)"
            />

            <KPICard
              title="TOTAL CHECK-INS"
              value={metrics.completions?.total}
              icon="✅"
              badgeText={`+${metrics.completions?.in_period || 0} in Period`}
              badgeType="success"
              colorBg="var(--accent-success-light)"
            />

            <KPICard
              title="REMINDERS ACTIVE"
              value={metrics.reminders?.total}
              icon="🔔"
              badgeText="Configured"
              badgeType="info"
              colorBg="var(--accent-primary-light)"
            />
          </div>

          {/* Session Usage Summary Card */}
          <div className="glass-card fade-in" style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
              ⏱️ Session & Usage Duration Analytics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL SESSIONS IN PERIOD</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                  {metrics.sessions?.total_in_period ?? 0}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ESTIMATED TOTAL USAGE</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-success)', marginTop: '0.2rem' }}>
                  {formatSeconds(metrics.sessions?.estimated_total_usage_seconds)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>ESTIMATED AVG SESSION</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-warning)', marginTop: '0.2rem' }}>
                  {formatSeconds(metrics.sessions?.estimated_avg_duration_seconds)}
                </div>
              </div>
            </div>

            {metrics.sessions?.usage_note && (
              <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color-light)', paddingTop: '0.75rem' }}>
                📌 <strong>Usage Note:</strong> {metrics.sessions.usage_note}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
