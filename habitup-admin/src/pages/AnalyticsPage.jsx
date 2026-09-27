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

  return (
    <div className="content-container">
      {/* Top Header & Period Selector */}
      <div className="dashboard-header-strip">
        <div>
          <h2 className="dashboard-title">Analytics</h2>
          <p className="dashboard-subtitle">In-depth engagement, usage trends, and user leaderboard</p>
        </div>

        <div className="timeframe-segmented-group" role="radiogroup" aria-label="Timeframe selection">
          {[
            { id: '1d', label: '24h', title: '1 Day (24 hours)' },
            { id: '7d', label: '7D', title: '7 Days' },
            { id: '30d', label: '30D', title: '30 Days' },
            { id: '90d', label: '90D', title: '90 Days' },
            { id: '365d', label: '1Y', title: '1 Year' },
          ].map((item) => (
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
          {/* Skeleton Summary Strip */}
          <div className="saas-metric-strip">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="saas-metric-card">
                <div className="skeleton skeleton-text" style={{ width: '45%' }} />
                <div className="skeleton" style={{ height: '32px', width: '55%', margin: '4px 0', borderRadius: '6px' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>

          {/* Skeleton Charts Grid */}
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

          {/* Skeleton Leaderboard */}
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
          {/* Summary Metric Strip */}
          <div className="saas-metric-strip">
            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">TOTAL SESSIONS</span>
                <span className="saas-metric-icon">
                  <Smartphone size={15} color="var(--accent-primary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{usageData?.summary?.total_sessions ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-primary">Recorded</span>
                <span className="saas-metric-note">in period</span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">ACTIVE USERS</span>
                <span className="saas-metric-icon">
                  <Users size={15} color="var(--accent-primary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{usageData?.summary?.active_users ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-info">Active</span>
                <span className="saas-metric-note">in period</span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">TOTAL USAGE</span>
                <span className="saas-metric-icon">
                  <Clock size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {formatSeconds(usageData?.summary?.estimated_total_usage_seconds)}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">Estimated</span>
                <span className="saas-metric-note">time spent</span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">AVERAGE SESSION</span>
                <span className="saas-metric-icon">
                  <Zap size={15} color="var(--accent-warning)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {formatSeconds(usageData?.summary?.estimated_avg_session_seconds)}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-warning">Per Session</span>
                <span className="saas-metric-note">avg duration</span>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="saas-grid-2col" style={{ alignItems: 'start' }}>
            {/* Daily Usage Chart */}
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <TrendingUp size={16} color="var(--accent-primary)" /> Daily Usage Trend
                  </h3>
                  <p className="saas-panel-subtitle">Session distribution across days</p>
                </div>
                <div className="saas-badge-counter">
                  <Activity size={13} color="var(--accent-primary)" />
                  <span>{usageData?.summary?.total_sessions ?? 0} Sessions</span>
                </div>
              </div>
              <div className="chart-content-box">
                <DailyUsageChart data={usageData?.daily || []} height={200} />
              </div>
            </div>

            {/* Event Distribution */}
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <PieChart size={16} color="var(--accent-secondary)" /> Activity Distribution
                  </h3>
                  <p className="saas-panel-subtitle">Event share by action type</p>
                </div>
              </div>
              <ActivityDistribution byType={activityData?.summary?.by_type || {}} />
            </div>
          </div>

          {/* Most Active Users Leaderboard */}
          <div className="saas-panel fade-in">
            <div className="saas-panel-header">
              <div>
                <h3 className="saas-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Trophy size={16} color="var(--accent-warning)" /> Most Active Users
                </h3>
                <p className="saas-panel-subtitle">Top users ranked by session frequency and engagement</p>
              </div>
              <div className="saas-metric-note" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {usageData?.most_active_users?.length || 0} Ranked Users
              </div>
            </div>
            <div className="table-container" style={{ boxShadow: 'none', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '10%' }}>Rank</th>
                    <th style={{ width: '45%' }}>User</th>
                    <th style={{ width: '20%', textAlign: 'right' }}>Sessions</th>
                    <th style={{ width: '25%', textAlign: 'right' }}>Est. Total Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData?.most_active_users && usageData.most_active_users.length > 0 ? (
                    usageData.most_active_users.map((user, idx) => (
                      <tr key={user.user_id || idx} style={{ cursor: 'default' }}>
                        <td>
                          <span
                            className={`badge-tag badge-${idx === 0 ? 'warning' : idx === 1 ? 'info' : 'primary'}`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                              {user.name || user.email}
                            </span>
                            {user.username && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                @{user.username}
                              </span>
                            )}
                            {user.name && user.email && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {user.email}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent-success)' }}>
                          {user.session_count}
                        </td>
                        <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {formatSeconds(user.estimated_usage_seconds)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2.5rem' }}>
                        No session activity recorded for this period.
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

