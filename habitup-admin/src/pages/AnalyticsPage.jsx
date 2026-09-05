import React, { useEffect, useState } from 'react';
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
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Usage & Activity Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            In-depth trend analysis, daily user engagement, and event distribution
          </p>
        </div>

        <div className="filter-group">
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Period:</label>
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
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Computing analytics reports...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {/* Daily Usage Chart */}
            <div className="glass-card fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                📊 Daily Session Usage Trend
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Sessions recorded per day over the selected timeframe
              </p>
              <DailyUsageChart data={usageData?.daily || []} />
            </div>

            {/* Event Distribution */}
            <div className="glass-card fade-in">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                🎯 Activity Event Breakdown
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Distribution of system actions by event type ({activityData?.summary?.total_events || 0} total events)
              </p>
              <ActivityDistribution byType={activityData?.summary?.by_type || {}} />
            </div>
          </div>

          {/* Most Active Users Leaderboard */}
          <div className="glass-card fade-in">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
              🏆 Most Active Users (Top Leaderboard)
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User Email</th>
                    <th>User ID</th>
                    <th>Session Count</th>
                    <th>Est. Total Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData?.most_active_users && usageData.most_active_users.length > 0 ? (
                    usageData.most_active_users.map((user, idx) => (
                      <tr key={user.user_id}>
                        <td>
                          <span
                            className={`badge-tag badge-${idx === 0 ? 'warning' : idx === 1 ? 'info' : 'success'}`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{user.email}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                          {user.user_id}
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>
                          {user.session_count}
                        </td>
                        <td>{formatSeconds(user.estimated_usage_seconds)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
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
