import React, { useEffect, useState } from 'react';
import {
  Users,
  Flame,
  UserPlus,
  CheckCircle2,
  Target,
  Bell,
  Clock,
  Activity,
  Trophy,
} from 'lucide-react';
import { api } from '../services/api';
import { ActivityTrendChart } from '../components/Charts';

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

export function DashboardPage() {
  const [period, setPeriod] = useState('7d');
  const [metrics, setMetrics] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [notificationStats, setNotificationStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async (selectedPeriod) => {
    setLoading(true);
    setError('');

    try {
      const [metricsRes, usageRes, activityRes, notifRes] = await Promise.allSettled([
        api.getDashboardMetrics(selectedPeriod),
        api.getUsageAnalytics({ period: selectedPeriod }),
        api.getActivityFeed({ limit: 6 }),
        api.getNotificationsList({ page: 1, limit: 1 }),
      ]);

      if (metricsRes.status === 'fulfilled') {
        setMetrics(metricsRes.value);
      } else {
        throw metricsRes.reason || new Error('Failed to load metrics');
      }

      if (usageRes.status === 'fulfilled') {
        setUsageData(usageRes.value);
      } else {
        setUsageData(null);
      }

      if (activityRes.status === 'fulfilled') {
        const feed = activityRes.value || {};
        setRecentActivity(feed.activities || feed.events || []);
      } else {
        setRecentActivity([]);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value?.stats) {
        setNotificationStats(notifRes.value.stats);
      } else {
        setNotificationStats(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(period);
  }, [period]);

  const formatSeconds = (sec) => {
    if (sec === undefined || sec === null) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${sec % 60}s`;
  };

  const formatDuration = (sec) => {
    if (sec === undefined || sec === null) return '0m';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const getActivityBadge = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('login')) return { label: 'Login', className: 'badge-primary' };
    if (t.includes('checkin') || t.includes('completion')) return { label: 'Check-in', className: 'badge-success' };
    if (t.includes('create') || t.includes('habit')) return { label: 'Habit', className: 'badge-info' };
    if (t.includes('delete') || t.includes('danger')) return { label: 'Action', className: 'badge-danger' };
    return { label: type || 'Event', className: 'badge-warning' };
  };

  const formatActivityDetail = (act) => {
    if (!act) return '—';
    if (act.metadata && typeof act.metadata === 'object') {
      if (act.metadata.habit_name) return `Habit: "${act.metadata.habit_name}"`;
      if (act.metadata.title) return act.metadata.title;
      if (act.metadata.note) return act.metadata.note;
    }
    return act.activity_type ? act.activity_type.replace(/_/g, ' ') : 'System activity';
  };

  const activeRate = metrics?.users?.total
    ? Math.round(((metrics.users.active_in_period || 0) / metrics.users.total) * 100)
    : 0;

  const newShare = metrics?.users?.total
    ? ((metrics.users.new_in_period || 0) / metrics.users.total) * 100
    : 0;

  const deliveryRate =
    notificationStats && notificationStats.total > 0
      ? Math.round((notificationStats.sent / notificationStats.total) * 100)
      : null;

  const topUsers = (usageData?.most_active_users || []).slice(0, 5);

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
        <div className="overview-stack fade-in" aria-busy="true" aria-label="Loading overview data">
          <div className="saas-metric-strip">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="saas-metric-card">
                <div className="skeleton skeleton-text" style={{ width: '45%' }} />
                <div className="skeleton" style={{ height: '32px', width: '55%', margin: '4px 0', borderRadius: '6px' }} />
                <div className="skeleton skeleton-text" style={{ width: '60%' }} />
              </div>
            ))}
          </div>

          <div className="saas-panel">
            <div className="skeleton skeleton-title" style={{ width: '22%' }} />
            <div className="skeleton skeleton-chart" />
          </div>

          <div className="saas-grid-2col">
            {[1, 2].map((i) => (
              <div className="saas-panel" key={i}>
                <div className="skeleton skeleton-title" style={{ width: '35%' }} />
                <div className="saas-dense-grid">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="dense-metric-tile">
                      <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                      <div className="skeleton" style={{ height: '24px', width: '65%', borderRadius: '4px' }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : metrics ? (
        <div className="overview-stack">
          {/* 1. KPI strip */}
          <div className="saas-metric-strip">
            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Total Users</span>
                <span className="saas-metric-icon">
                  <Users size={15} color="var(--accent-primary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{metrics.users?.total ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-primary">
                  +{metrics.users?.new_in_period || 0} new
                </span>
                <span className="saas-metric-note">
                  {metrics.users?.deleted_in_period
                    ? `${metrics.users.deleted_in_period} deleted in period`
                    : `registered accounts`}
                </span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Active Users</span>
                <span className="saas-metric-icon">
                  <Flame size={15} color="var(--accent-warning)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {metrics.users?.active_in_period ?? 0}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-info">{activeRate}% of total</span>
                <span className="saas-metric-note">
                  active {PERIOD_LABELS[period] || 'in period'}
                </span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">New Users</span>
                <span className="saas-metric-icon">
                  <UserPlus size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {metrics.users?.new_in_period ?? 0}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">
                  {newShare >= 1 ? `${newShare.toFixed(1)}%` : '<1%'} of total
                </span>
                <span className="saas-metric-note">joined in period</span>
              </div>
            </div>

            <div className="saas-metric-card fade-in">
              <div className="saas-metric-header">
                <span className="saas-metric-label">Total Check-ins</span>
                <span className="saas-metric-icon">
                  <CheckCircle2 size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">
                {metrics.completions?.total ?? 0}
              </div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">
                  +{metrics.completions?.in_period || 0} in period
                </span>
                <span className="saas-metric-note">all-time completions</span>
              </div>
            </div>
          </div>

          {/* 2. Primary analytics */}
          <div className="saas-panel fade-in">
            <div className="saas-panel-header">
              <div>
                <h3 className="saas-panel-title">Activity Trend</h3>
                <p className="saas-panel-subtitle">
                  Daily session volume across the {PERIOD_LABELS[period] || 'selected period'}
                </p>
              </div>
              <div className="saas-badge-counter">
                <Activity size={13} color="var(--accent-primary)" />
                <span>
                  {usageData?.summary?.total_sessions ?? metrics.sessions?.total_in_period ?? 0}{' '}
                  total sessions
                </span>
              </div>
            </div>
            <div className="chart-content-box">
              <ActivityTrendChart data={usageData?.daily || []} height={230} />
            </div>
          </div>

          {/* 3. Secondary analytics */}
          <div className="saas-grid-2col">
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">
                    <Target size={16} color="var(--accent-primary)" /> Habit Engagement &amp; Sessions
                  </h3>
                  <p className="saas-panel-subtitle">Product usage for the selected period</p>
                </div>
              </div>

              <div className="saas-dense-grid">
                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Total Habits</span>
                  <div className="dense-metric-val tabular-nums">{metrics.habits?.total ?? 0}</div>
                  <span className="dense-metric-sub">
                    +{metrics.habits?.created_in_period || 0} created in period
                  </span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Period Check-ins</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-success)' }}
                  >
                    {metrics.completions?.in_period ?? 0}
                  </div>
                  <span className="dense-metric-sub">
                    {metrics.completions?.total ?? 0} all-time
                  </span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Est. Total Usage</span>
                  <div className="dense-metric-val tabular-nums">
                    {formatSeconds(metrics.sessions?.estimated_total_usage_seconds)}
                  </div>
                  <span className="dense-metric-sub">
                    {metrics.sessions?.total_in_period ?? 0} sessions
                  </span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Est. Avg Session</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-warning)' }}
                  >
                    {formatSeconds(metrics.sessions?.estimated_avg_duration_seconds)}
                  </div>
                  <span className="dense-metric-sub">per user visit</span>
                </div>
              </div>

              {metrics.sessions?.usage_note && (
                <div className="saas-note-box">
                  <Clock size={13} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-primary)' }} />
                  <span>{metrics.sessions.usage_note}</span>
                </div>
              )}
            </div>

            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">
                    <Bell size={16} color="var(--accent-secondary)" /> Notification Delivery
                  </h3>
                  <p className="saas-panel-subtitle">
                    Push delivery outcomes recorded by the platform
                  </p>
                </div>
                {deliveryRate !== null && (
                  <div className="saas-badge-counter" style={{ color: 'var(--accent-success)', background: 'var(--accent-success-light)' }}>
                    <CheckCircle2 size={13} color="var(--accent-success)" />
                    <span>{deliveryRate}% delivered</span>
                  </div>
                )}
              </div>

              <div className="saas-dense-grid">
                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Active Reminders</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {metrics.reminders?.total ?? 0}
                  </div>
                  <span className="dense-metric-sub">scheduled by users</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Delivered</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-success)' }}
                  >
                    {notificationStats?.sent ?? '—'}
                  </div>
                  <span className="dense-metric-sub">successful sends</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Failed</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-danger)' }}
                  >
                    {notificationStats?.failed ?? '—'}
                  </div>
                  <span className="dense-metric-sub">delivery errors</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">Pending</span>
                  <div
                    className="dense-metric-val tabular-nums"
                    style={{ color: 'var(--accent-warning)' }}
                  >
                    {notificationStats?.pending ?? '—'}
                  </div>
                  <span className="dense-metric-sub">queued or processing</span>
                </div>
              </div>

              <div className="saas-notification-footer">
                <span className="saas-metric-note">
                  {notificationStats
                    ? `${notificationStats.total} notification records in total`
                    : 'Notification statistics unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Recent activity + top users */}
          <div className="saas-grid-overview">
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">Recent Activity</h3>
                  <p className="saas-panel-subtitle">Latest user and system events</p>
                </div>
                <div className="saas-badge-counter">
                  <Activity size={13} color="var(--accent-primary)" />
                  <span>last {recentActivity.length} events</span>
                </div>
              </div>

              {recentActivity.length > 0 ? (
                <div className="table-container" style={{ boxShadow: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Event</th>
                        <th>Details</th>
                        <th style={{ textAlign: 'right' }}>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((act) => {
                        const badge = getActivityBadge(act.activity_type);
                        return (
                          <tr key={act.id}>
                            <td>
                              <div className="cell-primary">
                                {act.user_display ||
                                  act.name ||
                                  act.user_name ||
                                  act.username ||
                                  act.email ||
                                  act.user_email ||
                                  'System'}
                              </div>
                              {(act.email || act.user_email) &&
                                (act.name || act.user_name) && (
                                  <div className="cell-secondary">
                                    {act.email || act.user_email}
                                  </div>
                                )}
                            </td>
                            <td>
                              <span className={`badge-tag ${badge.className}`}>{badge.label}</span>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                              {formatActivityDetail(act)}
                            </td>
                            <td
                              className="tabular-nums cell-muted"
                              style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                            >
                              {formatTimeAgo(act.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Activity size={20} />
                  </div>
                  <div className="empty-state-title">No recent activity</div>
                  <div className="empty-state-text">
                    Events will appear here as users interact with HabitUp.
                  </div>
                </div>
              )}
            </div>

            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">
                    <Trophy size={16} color="var(--accent-warning)" /> Most Active Users
                  </h3>
                  <p className="saas-panel-subtitle">Ranked by estimated time in app</p>
                </div>
              </div>

              {topUsers.length > 0 ? (
                <div className="rank-list">
                  {topUsers.map((u, idx) => (
                    <div className="rank-row" key={u.user_id || idx}>
                      <span className="rank-index">{idx + 1}</span>
                      <div className="rank-identity">
                        <span className="rank-name">{u.name || u.email || 'User'}</span>
                        <span className="rank-meta">
                          {u.username ? `@${u.username}` : u.email || '—'}
                        </span>
                      </div>
                      <div className="rank-value">
                        <span className="rank-value-main">{formatDuration(u.estimated_usage_seconds)}</span>
                        <span className="rank-value-sub">
                          {u.session_count ?? 0} sessions
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <Trophy size={20} />
                  </div>
                  <div className="empty-state-title">No session activity</div>
                  <div className="empty-state-text">
                    No sessions were recorded for this period.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
