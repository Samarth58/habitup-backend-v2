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

function UserCell({ ev }) {
  if (!ev.user_id) {
    return <span className="cell-muted" style={{ fontWeight: 600 }}>System</span>;
  }

  const primary = ev.user_name || ev.user_display || ev.user_username || ev.user_email || 'User';
  const secondary = ev.user_username
    ? `@${ev.user_username}`
    : ev.user_email || null;

  return (
    <div style={{ minWidth: 0 }}>
      <div className="cell-primary">{primary}</div>
      {secondary && <div className="cell-secondary">{secondary}</div>}
    </div>
  );
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
        setEvents(res.events || res.activities || []);
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
      {/* Filter bar */}
      <form onSubmit={handleSearch} className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by user name, email or @username..."
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          aria-label="Search user"
        />
        <button type="submit" className="pagination-btn">
          <Filter size={14} aria-hidden="true" /> Filter
        </button>

        <span className="filter-divider" aria-hidden="true" />

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

      {error && <div className="error-alert" role="alert">{error}</div>}

      {/* Activity table */}
      <div className="table-container fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Activity</th>
              <th>Details</th>
              <th style={{ textAlign: 'right' }}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <tr key={`skel-act-${i}`} aria-hidden="true">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '3px' }} />
                    </div>
                  </td>
                  <td><div className="skeleton" style={{ width: '85px', height: '20px', borderRadius: '999px' }} /></td>
                  <td><div className="skeleton" style={{ width: '220px', height: '14px', borderRadius: '3px' }} /></td>
                  <td><div className="skeleton" style={{ width: '130px', height: '14px', borderRadius: '3px', marginLeft: 'auto' }} /></td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-cell">
                  <strong>No activity found</strong>
                  <span>No events match the current filters.</span>
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <UserCell ev={ev} />
                  </td>
                  <td>
                    <span className={`badge-tag badge-${getBadgeStyle(ev.activity_type)}`}>
                      {ev.activity_type}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {formatActivityDetails(ev.activity_type, ev.metadata)}
                  </td>
                  <td
                    className="tabular-nums cell-muted"
                    style={{ textAlign: 'right', whiteSpace: 'nowrap' }}
                  >
                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <span>
          Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>{' '}
          ({pagination.total} total)
        </span>

        <div className="filter-group">
          <button
            className="pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <ChevronLeft size={16} aria-hidden="true" /> Previous
          </button>

          <button
            className="pagination-btn"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
          >
            Next <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
