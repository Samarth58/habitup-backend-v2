import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { api } from '../services/api';

export function formatActivityDetails(activityType, metadata) {
  if (!metadata || typeof metadata !== 'object') {
    switch (activityType) {
      case 'LOGIN': return 'Logged in';
      case 'LOGOUT': return 'Logged out';
      case 'LOGOUT_ALL': return 'All sessions ended';
      case 'REGISTER': return 'Account registered';
      case 'HABIT_CREATED': return 'Habit created';
      case 'HABIT_UPDATED': return 'Habit updated';
      case 'HABIT_DELETED': return 'Habit deleted';
      case 'HABIT_COMPLETED': return 'Habit completed';
      case 'HABIT_UNCOMPLETED': return 'Completion undone';
      case 'HABIT_COMPLETION_REMOVED': return 'Completion removed';
      case 'HABIT_PAUSED': return 'Habit paused';
      case 'HABIT_UNPAUSED': return 'Habit resumed';
      case 'HABIT_ARCHIVED': return 'Habit archived';
      case 'HABIT_UNARCHIVED': return 'Habit restored';
      case 'REMINDER_CREATED': return 'Reminder set';
      case 'REMINDER_UPDATED': return 'Reminder updated';
      case 'REMINDER_DELETED': return 'Reminder removed';
      case 'PASSWORD_RESET_REQUESTED': return 'Reset requested';
      case 'PASSWORD_RESET_COMPLETED': return 'Reset completed';
      case 'ACCOUNT_DELETED': return 'Account deleted';
      case 'FRIENDS_EXPERIMENT_EXPOSED': return 'Friends experiment';
      case 'EXPERIMENT_EXPOSURE': return 'Experiment exposed';
      case 'FRIEND_REQUEST_SENT': return 'Friend request sent';
      case 'FRIEND_REQUEST_ACCEPTED': return 'Friend request accepted';
      case 'FRIEND_REMOVED': return 'Friend removed';
      default: return '—';
    }
  }

  switch (activityType) {
    case 'FRIENDS_EXPERIMENT_EXPOSED': {
      if (metadata.variant) {
        return `Friends • Variant ${metadata.variant}`;
      }
      return 'Friends experiment';
    }
    case 'EXPERIMENT_EXPOSURE': {
      const expName = metadata.experiment === 'friends_feature_v1' ? 'Friends' : (metadata.experiment || 'Experiment');
      if (metadata.variant) {
        return `${expName} • Variant ${metadata.variant}`;
      }
      return 'Experiment exposed';
    }
    case 'FRIEND_REQUEST_SENT': {
      if (metadata.recipient_username) {
        return `Sent to @${metadata.recipient_username.replace(/^@/, '')}`;
      }
      return 'Friend request sent';
    }
    case 'FRIEND_REQUEST_ACCEPTED': return 'Friend request accepted';
    case 'FRIEND_REMOVED': return 'Friend removed';
    case 'HABIT_COMPLETED': return 'Habit completed';
    case 'HABIT_CREATED': return 'Habit created';
    case 'HABIT_UPDATED': return 'Habit updated';
    case 'HABIT_DELETED': return 'Habit deleted';
    case 'HABIT_UNCOMPLETED': return 'Completion undone';
    case 'HABIT_COMPLETION_REMOVED': return 'Completion removed';
    case 'HABIT_PAUSED': return 'Habit paused';
    case 'HABIT_UNPAUSED': return 'Habit resumed';
    case 'HABIT_ARCHIVED': return 'Habit archived';
    case 'HABIT_UNARCHIVED': return 'Habit restored';
    case 'REMINDER_CREATED': return 'Reminder set';
    case 'REMINDER_UPDATED': return 'Reminder updated';
    case 'REMINDER_DELETED': return 'Reminder removed';
    case 'PASSWORD_RESET_REQUESTED': return 'Reset requested';
    case 'PASSWORD_RESET_COMPLETED': return 'Reset completed';
    case 'ACCOUNT_DELETED': return 'Account deleted';
    case 'LOGIN': return 'Logged in';
    case 'LOGOUT': return 'Logged out';
    case 'LOGOUT_ALL': return 'All sessions ended';
    case 'REGISTER': return 'Account registered';
    default: return '—';
  }
}

function renderUserCell(ev) {
  if (!ev.user_id) {
    return <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>System</span>;
  }
  if (ev.user_name && ev.user_username) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>{ev.user_name}</span>
        <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 600 }}>@{ev.user_username}</span>
      </div>
    );
  }
  if (ev.user_name) {
    return <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>{ev.user_name}</span>;
  }
  if (ev.user_username) {
    return <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.84rem' }}>@{ev.user_username}</span>;
  }
  if (ev.user_email) {
    return <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.82rem' }}>{ev.user_email}</span>;
  }
  return <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem' }}>{ev.user_display || 'User'}</span>;
}

export function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [activityType, setActivityType] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchActivity = () => {
    setLoading(true);
    setError('');

    api.getActivityFeed({
      page,
      limit: 50,
      activityType: activityType || undefined,
      userId: userFilter.trim() || undefined,
    })
      .then((res) => {
        setEvents(res.events || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load activity');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchActivity();
  }, [page, activityType]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchActivity();
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'LOGIN': return 'info';
      case 'REGISTER': return 'success';
      case 'HABIT_COMPLETED': return 'success';
      case 'HABIT_CREATED': return 'primary';
      case 'HABIT_UPDATED': return 'warning';
      case 'HABIT_DELETED': return 'danger';
      default: return 'info';
    }
  };

  return (
    <div className="content-container">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-heading">
          <h2 className="toolbar-title">Activity</h2>
        </div>

        <form onSubmit={handleSearch} className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Search user..."
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            aria-label="Search user"
          />
          <button type="submit" className="pagination-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
            <Filter size={14} /> Filter
          </button>

          <select
            className="select-input"
            value={activityType}
            onChange={(e) => { setActivityType(e.target.value); setPage(1); }}
            aria-label="Filter by event type"
          >
            <option value="">All Types</option>
            <option value="LOGIN">LOGIN</option>
            <option value="REGISTER">REGISTER</option>
            <option value="HABIT_CREATED">HABIT_CREATED</option>
            <option value="HABIT_COMPLETED">HABIT_COMPLETED</option>
            <option value="HABIT_UPDATED">HABIT_UPDATED</option>
            <option value="HABIT_DELETED">HABIT_DELETED</option>
          </select>
        </form>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Activity Table */}
      <div className="table-container fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Activity Type</th>
              <th>User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Loading activity...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                  No activity found.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge-tag badge-${getBadgeStyle(ev.activity_type)}`}>
                      {ev.activity_type}
                    </span>
                  </td>
                  <td>
                    {renderUserCell(ev)}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {formatActivityDetails(ev.activity_type, ev.metadata)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="pagination">
        <span>
          Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
        </span>

        <div className="filter-group">
          <button
            className="pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <button
            className="pagination-btn"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
