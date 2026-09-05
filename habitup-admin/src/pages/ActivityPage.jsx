import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export function ActivityPage() {
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [activityType, setActivityType] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchActivity = () => {
    setLoading(true);
    setError('');

    api.getActivityFeed({
      page,
      limit: 50,
      activityType: activityType || undefined,
      userId: userIdFilter.trim() || undefined,
    })
      .then((res) => {
        setEvents(res.events || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load activity audit log');
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
          <h2 className="toolbar-title">Activity Audit Feed</h2>
          <p className="toolbar-subtitle">
            System-wide audit trail of user logins, registrations, and habit check-ins
          </p>
        </div>

        <form onSubmit={handleSearch} className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Filter by User UUID..."
            value={userIdFilter}
            onChange={(e) => setUserIdFilter(e.target.value)}
          />
          <button type="submit" className="pagination-btn" style={{ fontWeight: 600 }}>Filter User</button>

          <select
            className="select-input"
            value={activityType}
            onChange={(e) => { setActivityType(e.target.value); setPage(1); }}
          >
            <option value="">All Event Types</option>
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
              <th>User ID</th>
              <th>Metadata / Context</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Loading audit logs...
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                  No audit events found for selected filters.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge-tag badge-${getBadgeStyle(ev.activity_type)}`}>
                      {ev.activity_type}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {ev.user_id || 'System'}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {ev.metadata ? (
                      <span className="neu-inset-tile" style={{ display: 'inline-block', padding: '0.2rem 0.5rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {JSON.stringify(ev.metadata)}
                      </span>
                    ) : '—'}
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
          Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total audit events)
        </span>

        <div className="filter-group">
          <button
            className="pagination-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            ← Previous
          </button>

          <button
            className="pagination-btn"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
