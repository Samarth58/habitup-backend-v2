import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
        <div className="toolbar-heading">
          <h2 className="toolbar-title">Users</h2>
        </div>

        <form onSubmit={handleSearchSubmit} className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="Search email or @username..."
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            aria-label="Search by email or username"
          />
          <button type="submit" className="pagination-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}>
            <Search size={14} /> Search
          </button>

          <select
            className="select-input"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by account status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="deleted">Deleted</option>
          </select>

          <select
            className="select-input"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            aria-label="Sort by field"
          >
            <option value="created_at">Created Date</option>
            <option value="username">Username</option>
            <option value="email">Email</option>
            <option value="last_activity">Last Activity</option>
          </select>

          <select
            className="select-input"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Sort order"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </form>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Users Data Table */}
      <div className="table-container fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Habits</th>
              <th>Completions</th>
              <th>Usage</th>
              <th>Joined</th>
              <th>Last Activity</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                  No users found matching filters.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} onClick={() => setSelectedUserId(u.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div className="avatar" aria-hidden="true">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{u.name}</span>
                          {u.username && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              @{u.username}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge-tag badge-${u.role === 'admin' ? 'info' : 'primary'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-tag badge-${u.status === 'deleted' || u.deleted_at ? 'danger' : 'success'}`}>
                      {u.status || (u.deleted_at ? 'deleted' : 'active')}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ fontWeight: 700 }}>{u.total_habits ?? 0}</td>
                  <td className="tabular-nums" style={{ fontWeight: 700 }}>{u.total_completions ?? 0}</td>
                  <td className="tabular-nums" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatDuration(u.estimated_usage_seconds)}</td>
                  <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {u.last_activity_at
                      ? new Date(u.last_activity_at).toLocaleDateString()
                      : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserId(u.id);
                      }}
                    >
                      View Profile
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

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
