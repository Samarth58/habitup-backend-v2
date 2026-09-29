import React, { useEffect, useState } from 'react';
import {
  Smartphone,
  Users,
  Clock,
  Zap,
  TrendingUp,
  PieChart,
  Trophy,
  Activity,
} from 'lucide-react';
import { api } from '../services/api';
import { DailyUsageChart, ActivityDistribution } from '../components/Charts';

const PERIOD_OPTIONS = [
  { id: '1d', label: '24h', title: '1 Day (24 hours)' },
  { id: '7d', label: '7D', title: '7 Days' },
  { id: '30d', label: '30D', title: '30 Days' },
  { id: '90d', label: '90D', title: '90 Days' },
  { id: '365d', label: '1Y', title: '1 Year' },
];

const PERIOD_LABELS = {
  '1d': 'last 24 hours',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  '365d': 'last 12 months',
};

export function AnalyticsPage() {
  const [period, setPeriod] = useState('7d');
  const [usageData, setUsageData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = (selectedPeriod) => {
    setLoading(true);
    setError('');

    Promise.all([
      api.getUsageAnalytics({ period: selectedPeriod }),
      api.getActivityAnalytics({ period: selectedPeriod }),
    ])
      .then(([usage, activity]) => {
        setUsageData(usage);
        setActivityData(activity);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load analytics');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData(period);
  }, [period]);

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const totalEvents = activityData?.summary?.total_events ?? 0;

  return (
    <div className="content-container">
      {/* Controls row: timeframe selector */}
      <div className="dashboard-header-strip toolbar--end">
        <div className="timeframe-segmented-group" role="radiogroup" aria-label="Timeframe selection">
          {PERIOD_OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={period === item.id}
              className={`timeframe-pill-btn ${period === item.id ? 'active' : ''}`}
              onClick={() => setPeriod(item.id)}
              title={item.title}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-alert" role="alert">{error}</div>}

      {loading ? (
        <div className="overview-stack fade-in" aria-busy="true" aria-label="Loading analytics">
          <div className="saas-metric-strip">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="saas-metric-card">
                <div className="skeleton skeleton-text" style={{ width: '45%' }} />
                <div className="skeleton" style={{ height: '32px', width: '55%', margin: '4px 0', borderRadius: '6px' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>

          <div className="saas-grid-2col">
            <div className="saas-panel">
              <div className="skeleton skeleton-title" style={{ width: '30%' }} />
              <div className="skeleton skeleton-chart" style={{ height: '200px' }} />
            </div>
            <div className="saas-panel">
              <div className="skeleton skeleton-title" style={{ width: '30%' }} />
              <div className="skeleton skeleton-chart" style={{ height: '200px' }} />
            </div>
          </div>

          <div className="saas-panel">
            <div className="skeleton skeleton-title" style={{ width: '25%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="overview-stack">
          {/* Summary metrics */}
          <div className="saas-metric-strip">
            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Total Sessions</span>
                <span className="saas-metric-icon">
                  <Smartphone size={15} color="var(--accent-primary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {usageData?.summary?.total_sessions ?? 0}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-primary">Recorded</span>
                <span className="saas-metric-note">
                  {PERIOD_LABELS[period] || 'in period'}
                </span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Active Users</span>
                <span className="saas-metric-icon">
                  <Users size={15} color="var(--accent-secondary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {usageData?.summary?.active_users ?? 0}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-info">Distinct</span>
                <span className="saas-metric-note">with a session in period</span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Total Usage</span>
                <span className="saas-metric-icon">
                  <Clock size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {formatSeconds(usageData?.summary?.estimated_total_usage_seconds)}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">Estimated</span>
                <span className="saas-metric-note">time spent in app</span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Average Session</span>
                <span className="saas-metric-icon">
                  <Zap size={15} color="var(--accent-warning)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {formatSeconds(usageData?.summary?.estimated_avg_session_seconds)}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-warning">Per session</span>
                <span className="saas-metric-note">average duration</span>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="saas-grid-2col" style={{ alignItems: 'start' }}>
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">
                    <TrendingUp size={16} color="var(--accent-primary)" /> Daily Usage Trend
                  </h3>
                  <p className="saas-panel-subtitle">
                    Sessions recorded per day in the {PERIOD_LABELS[period] || 'selected period'}
                  </p>
                </div>
                <div className="saas-badge-counter">
                  <Activity size={13} color="var(--accent-primary)" />
                  <span>{usageData?.summary?.total_sessions ?? 0} sessions</span>
                </div>
              </div>
              <div className="chart-content-box">
                <DailyUsageChart data={usageData?.daily || []} height={210} />
              </div>
            </div>

            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">
                    <PieChart size={16} color="var(--accent-secondary)" /> Activity Distribution
                  </h3>
                  <p className="saas-panel-subtitle">Share of events by action type</p>
                </div>
                <div className="saas-badge-counter">
                  <Activity size={13} color="var(--accent-secondary)" />
                  <span>{totalEvents} events</span>
                </div>
              </div>
              <ActivityDistribution byType={activityData?.summary?.by_type || {}} />
            </div>
          </div>

          {/* Leaderboard */}
          <div className="saas-panel fade-in">
            <div className="saas-panel-header">
              <div>
                <h3 className="saas-panel-title">
                  <Trophy size={16} color="var(--accent-warning)" /> Most Active Users
                </h3>
                <p className="saas-panel-subtitle">
                  Top users ranked by session frequency and estimated usage
                </p>
              </div>
              <div className="saas-badge-counter">
                <Users size={13} color="var(--accent-primary)" />
                <span>{usageData?.most_active_users?.length || 0} ranked users</span>
              </div>
            </div>

            <div className="table-container" style={{ boxShadow: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Rank</th>
                    <th style={{ width: '45%' }}>User</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Sessions</th>
                    <th style={{ width: '25%', textAlign: 'right' }}>Est. Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData?.most_active_users && usageData.most_active_users.length > 0 ? (
                    usageData.most_active_users.map((user, idx) => (
                      <tr key={user.user_id || idx}>
                        <td>
                          <span
                            className={`badge-tag badge-${
                              idx === 0 ? 'warning' : idx === 1 ? 'info' : 'primary'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td>
                          <div className="cell-primary">
                            {user.name || user.email || 'User'}
                          </div>
                          <div className="cell-secondary">
                            {user.username ? `@${user.username}` : user.email || '—'}
                          </div>
                        </td>
                        <td className="cell-numeric" style={{ textAlign: 'right' }}>
                          {user.session_count}
                        </td>
                        <td
                          className="tabular-nums"
                          style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}
                        >
                          {formatSeconds(user.estimated_usage_seconds)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        <strong>No session activity</strong>
                        <span>No sessions were recorded for this period.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
