import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { UserDetailModal } from '../components/UserDetailModal';

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [emailSearch, setEmailSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Selected User Modal
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchUsers = () => {
    setLoading(true);
    setError('');

    api.getUsersList({
      page,
      limit: 20,
      email: emailSearch.trim() || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      sort: sortField,
      order: sortOrder,
    })
      .then((res) => {
        setUsers(res.users || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load user list');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, statusFilter, sortField, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="content-container">
      {/* Toolbar */}
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>User Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Filter, search, and inspect registered accounts and usage statistics
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Search by email..."
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
          />
          <button type="submit" className="pagination-btn">Search</button>

          <select
            className="select-input"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
          </select>

          <select
            className="select-input"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
          >
            <option value="created_at">Created Date</option>
            <option value="email">Email</option>
            <option value="last_activity">Last Activity</option>
          </select>

          <select
            className="select-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Desc (Newest)</option>
            <option value="asc">Asc (Oldest)</option>
          </select>
        </form>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Users Data Table */}
      <div className="table-container fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>User / Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Habits</th>
              <th>Completions</th>
              <th>Usage</th>
              <th>Joined Date</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Loading users table...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  No users found matching the selected filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} onClick={() => setSelectedUserId(u.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px' }}>
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge-tag badge-${u.role === 'admin' ? 'info' : 'success'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-tag badge-${u.status === 'deleted' || u.deleted_at ? 'danger' : 'success'}`}>
                      {u.status || (u.deleted_at ? 'deleted' : 'active')}
                    </span>
                  </td>
                  <td>{u.total_habits ?? 0}</td>
                  <td>{u.total_completions ?? 0}</td>
                  <td>{formatDuration(u.estimated_usage_seconds)}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    {u.last_activity_at
                      ? new Date(u.last_activity_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <button
                      className="pagination-btn"
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId(u.id);
                      }}
                    >
                      View Details
                    </button>
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
          Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total users)
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

      {/* User Detail Slide-over Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
