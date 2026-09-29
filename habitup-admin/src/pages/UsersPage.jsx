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
      {/* Filter bar */}
      <form onSubmit={handleSearchSubmit} className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder="Search by email or @username..."
          value={emailSearch}
          onChange={(e) => setEmailSearch(e.target.value)}
          aria-label="Search by email or username"
        />
        <button type="submit" className="pagination-btn">
          <Search size={14} aria-hidden="true" /> Search
        </button>

        <span className="filter-divider" aria-hidden="true" />

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

        <span className="filter-divider" aria-hidden="true" />

        <select
          className="select-input"
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          aria-label="Sort by field"
        >
          <option value="created_at">Sort: Created Date</option>
          <option value="username">Sort: Username</option>
          <option value="email">Sort: Email</option>
          <option value="last_activity">Sort: Last Activity</option>
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

      {error && <div className="error-alert" role="alert">{error}</div>}

      {/* Users table */}
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
              [1, 2, 3, 4, 5].map((i) => (
                <tr key={`skel-${i}`} aria-hidden="true">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      <div style={{ flex: 1 }}>
                        <div className="skeleton skeleton-text" style={{ width: '60%', height: '12px' }} />
                        <div className="skeleton skeleton-text" style={{ width: '40%', height: '10px', marginBottom: 0 }} />
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton" style={{ width: '45px', height: '18px', borderRadius: '999px' }} /></td>
                  <td><div className="skeleton" style={{ width: '50px', height: '18px', borderRadius: '999px' }} /></td>
                  <td><div className="skeleton" style={{ width: '30px', height: '14px', borderRadius: '3px' }} /></td>
                  <td><div className="skeleton" style={{ width: '30px', height: '14px', borderRadius: '3px' }} /></td>
                  <td><div className="skeleton" style={{ width: '50px', height: '14px', borderRadius: '3px' }} /></td>
                  <td><div className="skeleton" style={{ width: '65px', height: '14px', borderRadius: '3px' }} /></td>
                  <td><div className="skeleton" style={{ width: '65px', height: '14px', borderRadius: '3px' }} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '6px', marginLeft: 'auto' }} />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-cell">
                  <strong>No users found</strong>
                  <span>No accounts match the current search or filters.</span>
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="row-clickable" onClick={() => setSelectedUserId(u.id)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div className="avatar" aria-hidden="true">
                        {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="cell-primary">{u.name || 'Unnamed user'}</div>
                        <div className="cell-secondary">
                          {u.username ? `@${u.username} · ` : ''}
                          {u.email}
                        </div>
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
                  <td className="cell-numeric">{u.total_habits ?? 0}</td>
                  <td className="cell-numeric">{u.total_completions ?? 0}</td>
                  <td className="tabular-nums" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {formatDuration(u.estimated_usage_seconds)}
                  </td>
                  <td className="tabular-nums cell-muted" style={{ whiteSpace: 'nowrap' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="tabular-nums cell-muted" style={{ whiteSpace: 'nowrap' }}>
                    {u.last_activity_at ? new Date(u.last_activity_at).toLocaleDateString() : '—'}
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
