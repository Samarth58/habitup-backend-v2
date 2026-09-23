import React, { useEffect, useState } from 'react';
import {
  Users,
  Flame,
  UserPlus,
  CheckCircle2,
  Target,
  Bell,
  Clock,
  Zap,
  Activity,
  Send,
  AlertTriangle,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { ActivityTrendChart } from '../components/Charts';

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

      if (activityRes.status === 'fulfilled' && activityRes.value?.activities) {
        setRecentActivity(activityRes.value.activities);
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

  return (
    <div className="content-container">
      {/* Top Header & Period Selector */}
      <div className="dashboard-header-strip">
        <div>
          <h2 className="dashboard-title">Overview</h2>
          <p className="dashboard-subtitle">Real-time operational snapshot of HabitUp ecosystem</p>
        </div>

        <div className="filter-group">
          <label
            htmlFor="dashboard-period-select"
            style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}
          >
            Timeframe:
          </label>
          <select
            id="dashboard-period-select"
            className="select-input"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="1d">1 Day (24h)</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="365d">1 Year</option>
          </select>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {loading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading overview data...
        </div>
      ) : metrics ? (
        <div className="overview-stack">
          {/* 1. Compact Metric Strip */}
          <div className="saas-metric-strip">
            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">TOTAL USERS</span>
                <span className="saas-metric-icon">
                  <Users size={15} color="var(--accent-primary)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{metrics.users?.total ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-primary">+{metrics.users?.new_in_period || 0} New</span>
                <span className="saas-metric-note">registered</span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">ACTIVE USERS</span>
                <span className="saas-metric-icon">
                  <Flame size={15} color="var(--accent-warning)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{metrics.users?.active_in_period ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-warning">
                  {metrics.users?.deleted_in_period || 0} Deleted
                </span>
                <span className="saas-metric-note">in period</span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">NEW USERS</span>
                <span className="saas-metric-icon">
                  <UserPlus size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{metrics.users?.new_in_period ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">Active Rate</span>
                <span className="saas-metric-note">
                  {metrics.users?.total ? Math.round(((metrics.users?.active_in_period || 0) / metrics.users.total) * 100) : 0}% active
                </span>
              </div>
            </div>

            <div className="saas-metric-card">
              <div className="saas-metric-header">
                <span className="saas-metric-label">TOTAL CHECK-INS</span>
                <span className="saas-metric-icon">
                  <CheckCircle2 size={15} color="var(--accent-success)" />
                </span>
              </div>
              <div className="saas-metric-value tabular-nums">{metrics.completions?.total ?? 0}</div>
              <div className="saas-metric-sub">
                <span className="badge-tag badge-success">+{metrics.completions?.in_period || 0}</span>
                <span className="saas-metric-note">in period</span>
              </div>
            </div>
          </div>

          {/* 2. Main Activity Trend Chart */}
          <div className="saas-panel fade-in">
            <div className="saas-panel-header">
              <div>
                <h3 className="saas-panel-title">Activity Trend</h3>
                <p className="saas-panel-subtitle">User session volume over the selected period</p>
              </div>
              <div className="saas-badge-counter">
                <Activity size={13} color="var(--accent-primary)" />
                <span>{usageData?.summary?.total_sessions ?? metrics.sessions?.total_in_period ?? 0} Total Sessions</span>
              </div>
            </div>
            <div className="chart-content-box">
              <ActivityTrendChart data={usageData?.daily || []} height={230} />
            </div>
          </div>

          {/* 3. Two-Column Lower Sections */}
          <div className="saas-grid-2col">
            {/* Left Column: Habit Engagement & Session Usage */}
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <h3 className="saas-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Target size={16} color="var(--accent-primary)" /> Habit Engagement & Sessions
                </h3>
              </div>

              <div className="saas-dense-grid">
                <div className="dense-metric-tile">
                  <span className="dense-metric-label">TOTAL HABITS</span>
                  <div className="dense-metric-val tabular-nums">{metrics.habits?.total ?? 0}</div>
                  <span className="dense-metric-sub">+{metrics.habits?.created_in_period || 0} created</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">PERIOD CHECK-INS</span>
                  <div className="dense-metric-val tabular-nums" style={{ color: 'var(--accent-success)' }}>
                    {metrics.completions?.in_period ?? 0}
                  </div>
                  <span className="dense-metric-sub">{metrics.completions?.total ?? 0} all-time</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">EST. TOTAL USAGE</span>
                  <div className="dense-metric-val tabular-nums">
                    {formatSeconds(metrics.sessions?.estimated_total_usage_seconds)}
                  </div>
                  <span className="dense-metric-sub">{metrics.sessions?.total_in_period ?? 0} sessions</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">EST. AVG SESSION</span>
                  <div className="dense-metric-val tabular-nums" style={{ color: 'var(--accent-warning)' }}>
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

            {/* Right Column: Notification Health & System */}
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <h3 className="saas-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Bell size={16} color="var(--accent-secondary)" /> Notification Health & Delivery
                </h3>
              </div>

              <div className="saas-dense-grid">
                <div className="dense-metric-tile">
                  <span className="dense-metric-label">ACTIVE REMINDERS</span>
                  <div className="dense-metric-val tabular-nums" style={{ color: 'var(--accent-primary)' }}>
                    {metrics.reminders?.total ?? 0}
                  </div>
                  <span className="dense-metric-sub">User scheduled</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">DELIVERED</span>
                  <div className="dense-metric-val tabular-nums" style={{ color: 'var(--accent-success)' }}>
                    {notificationStats?.sent ?? 0}
                  </div>
                  <span className="dense-metric-sub">Broadcasts sent</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">FAILED / BOUNCED</span>
                  <div className="dense-metric-val tabular-nums" style={{ color: 'var(--accent-danger)' }}>
                    {notificationStats?.failed ?? 0}
                  </div>
                  <span className="dense-metric-sub">Push failures</span>
                </div>

                <div className="dense-metric-tile">
                  <span className="dense-metric-label">SYSTEM STATUS</span>
                  <div className="dense-status-badge">
                    <span className="status-ping-dot"></span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-success)', fontSize: '0.82rem' }}>Healthy</span>
                  </div>
                  <span className="dense-metric-sub">APIs operational</span>
                </div>
              </div>

              <div className="saas-notification-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  <Radio size={13} color="var(--accent-success)" />
                  <span>Push notification gateway active & connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Recent Activity Feed Table */}
          {recentActivity && recentActivity.length > 0 && (
            <div className="saas-panel fade-in">
              <div className="saas-panel-header">
                <div>
                  <h3 className="saas-panel-title">Recent Activity</h3>
                  <p className="saas-panel-subtitle">Latest operations and user interactions</p>
                </div>
                <div className="saas-metric-note" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Showing last {recentActivity.length} events
                </div>
              </div>

              <div className="table-container" style={{ boxShadow: 'none', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>User</th>
                      <th style={{ width: '18%' }}>Event</th>
                      <th style={{ width: '38%' }}>Details</th>
                      <th style={{ width: '16%', textAlign: 'right' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map((act) => {
                      const badge = getActivityBadge(act.activity_type);
                      return (
                        <tr key={act.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                                {act.name || act.username || act.email || 'Anonymous User'}
                              </span>
                              {act.email && act.name && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {act.email}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`badge-tag ${badge.className}`}>{badge.label}</span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {formatActivityDetail(act)}
                          </td>
                          <td className="tabular-nums" style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {formatTimeAgo(act.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

