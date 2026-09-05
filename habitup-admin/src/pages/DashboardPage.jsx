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
          <h2 className="toolbar-title">Executive Dashboard</h2>
          <p className="toolbar-subtitle">
            System health, active user engagement, and core habit tracking metrics
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
          {/* Section 1: Core User & Habit KPIs */}
          <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            User & Habit Engagement
          </div>
          <div className="stats-grid">
            <KPICard
              title="Total Users"
              value={metrics.users?.total}
              icon="👥"
              badgeText={`+${metrics.users?.new_in_period || 0} New`}
              badgeType="success"
            />

            <KPICard
              title="Active Users"
              value={metrics.users?.active_in_period}
              icon="🔥"
              badgeText={`${metrics.users?.deleted_in_period || 0} Deleted`}
              badgeType="warning"
            />

            <KPICard
              title="Habits Created"
              value={metrics.habits?.total}
              icon="🎯"
              badgeText={`+${metrics.habits?.created_in_period || 0} in Period`}
              badgeType="info"
            />

            <KPICard
              title="Habit Completions"
              value={metrics.completions?.total}
              icon="✅"
              badgeText={`+${metrics.completions?.in_period || 0} in Period`}
              badgeType="success"
            />
          </div>

          {/* Section 2: Reminders & Session Analytics */}
          <div style={{ marginBottom: '0.75rem', marginTop: '1rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Reminders & Session Duration
          </div>
          <div className="stats-grid">
            <KPICard
              title="Reminders Configured"
              value={metrics.reminders?.total}
              icon="🔔"
              badgeText="Active"
              badgeType="info"
            />

            <KPICard
              title="Total Sessions"
              value={metrics.sessions?.total_in_period ?? 0}
              icon="📱"
              badgeText="In Period"
              badgeType="primary"
            />

            <KPICard
              title="Total Usage Duration"
              value={formatSeconds(metrics.sessions?.estimated_total_usage_seconds)}
              icon="⏱️"
              badgeText="Estimated"
              badgeType="success"
            />

            <KPICard
              title="Avg Session Duration"
              value={formatSeconds(metrics.sessions?.estimated_avg_duration_seconds)}
              icon="⚡"
              badgeText="Per Active User"
              badgeType="warning"
            />
          </div>

          {/* Usage Context Note */}
          {metrics.sessions?.usage_note && (
            <div className="glass-card fade-in" style={{ marginTop: '0.5rem', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                📌 <strong>Platform Usage Note:</strong> {metrics.sessions.usage_note}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
