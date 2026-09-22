import React, { useEffect, useState } from 'react';
import {
  Users,
  Flame,
  Target,
  CheckCircle2,
  Bell,
  Clock,
  Info,
} from 'lucide-react';
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
          <h2 className="toolbar-title">Overview</h2>
        </div>

        <div className="filter-group">
          <label htmlFor="dashboard-period-select" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Period:
          </label>
          <select
            id="dashboard-period-select"
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
              icon={<Users size={18} color="var(--accent-primary)" />}
              badgeText={`+${metrics.users?.new_in_period || 0} New`}
              badgeType="success"
            />

            <KPICard
              title="ACTIVE USERS IN PERIOD"
              value={metrics.users?.active_in_period}
              icon={<Flame size={18} color="var(--accent-warning)" />}
              badgeText={`${metrics.users?.deleted_in_period || 0} Deleted`}
              badgeType="warning"
            />

            <KPICard
              title="TOTAL HABITS CREATED"
              value={metrics.habits?.total}
              icon={<Target size={18} color="var(--accent-primary)" />}
              badgeText={`+${metrics.habits?.created_in_period || 0} in Period`}
              badgeType="info"
            />

            <KPICard
              title="TOTAL CHECK-INS"
              value={metrics.completions?.total}
              icon={<CheckCircle2 size={18} color="var(--accent-success)" />}
              badgeText={`+${metrics.completions?.in_period || 0} in Period`}
              badgeType="success"
            />

            <KPICard
              title="REMINDERS ACTIVE"
              value={metrics.reminders?.total}
              icon={<Bell size={18} color="var(--accent-secondary)" />}
              badgeText="Configured"
              badgeType="info"
            />
          </div>

          {/* Session Usage Summary Card */}
          <div className="glass-card fade-in" style={{ marginBottom: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
              <Clock size={18} color="var(--accent-primary)" /> Session & Usage Analytics
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  TOTAL SESSIONS
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>
                  {metrics.sessions?.total_in_period ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  ESTIMATED TOTAL USAGE
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-success)', marginTop: '0.25rem' }}>
                  {formatSeconds(metrics.sessions?.estimated_total_usage_seconds)}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  ESTIMATED AVG SESSION
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-warning)', marginTop: '0.25rem' }}>
                  {formatSeconds(metrics.sessions?.estimated_avg_duration_seconds)}
                </div>
              </div>
            </div>

            {metrics.sessions?.usage_note && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginTop: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(226, 232, 240, 0.7)', paddingTop: '0.85rem' }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-primary)' }} />
                <div><strong>Note:</strong> {metrics.sessions.usage_note}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
