import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DailyUsageChart, ActivityDistribution } from '../components/Charts';
import { KPICard } from '../components/KPICard';

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
        setError(err.message || 'Failed to load analytics reports');
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
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-heading">
          <h2 className="toolbar-title">Usage & Engagement Analytics</h2>
          <p className="toolbar-subtitle">
            Longitudinal session trends, user distribution, and engagement leaderboards
          </p>
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Period:</label>
          <select
            className="select-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
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
          Computing analytics workspace...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Usage Analytics Top Summary Cards */}
          <div className="stats-grid">
            <KPICard
              title="Total Sessions"
              value={usageData?.summary?.total_sessions ?? 0}
              icon="📱"
              badgeText="Recorded"
              badgeType="primary"
            />
            <KPICard
              title="Active Users"
              value={usageData?.summary?.active_users ?? 0}
              icon="👥"
              badgeText="In Period"
              badgeType="info"
            />
            <KPICard
              title="Total Usage"
              value={formatSeconds(usageData?.summary?.estimated_total_usage_seconds)}
              icon="⏱️"
              badgeText="Estimated"
              badgeType="success"
            />
            <KPICard
              title="Average Session"
              value={formatSeconds(usageData?.summary?.estimated_avg_session_seconds)}
              icon="⚡"
              badgeText="Per Session"
              badgeType="warning"
            />
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Daily Usage Chart */}
            <div className="glass-card fade-in">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                📊 Daily Session Usage Trend
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Daily activity sessions recorded across the platform
              </p>
              <DailyUsageChart data={usageData?.daily || []} />
            </div>

            {/* Event Distribution */}
            <div className="glass-card fade-in">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                🎯 Activity Distribution Breakdown
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Event distribution across {activityData?.summary?.total_events || 0} total actions
              </p>
              <ActivityDistribution byType={activityData?.summary?.by_type || {}} />
            </div>
          </div>

          {/* Most Active Users Leaderboard */}
          <div className="glass-card fade-in">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
              🏆 Most Active Users Leaderboard
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User Email</th>
                    <th>User ID</th>
                    <th>Sessions</th>
                    <th>Est. Total Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData?.most_active_users && usageData.most_active_users.length > 0 ? (
                    usageData.most_active_users.map((user, idx) => (
                      <tr key={user.user_id}>
                        <td>
                          <span
                            className={`badge-tag badge-${idx === 0 ? 'warning' : idx === 1 ? 'info' : 'primary'}`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{user.email}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent-primary)' }}>
                          {user.user_id}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>
                          {user.session_count}
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{formatSeconds(user.estimated_usage_seconds)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2.5rem' }}>
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
