import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
  Bell,
  AlertTriangle,
  Clock,
  Users,
  User,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';
import { api } from '../services/api';
import { KPICard } from '../components/KPICard';

const CATEGORY_MAP = {
  'Daily Reminder': 'motivation',
  'Friend Request': 'announcement',
  'Friend Nudge': 'encouragement',
  'Achievement': 'streak',
  'System Notification': 'announcement',
  'Evening Reminder': 'habit_tip',
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Dialog & alerts
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [successToast, setSuccessToast] = useState('');

  // Target mode & user search state
  const [targetMode, setTargetMode] = useState('all'); // 'all' | 'user'
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    type: 'Daily Reminder',
    title: '',
    message: '',
  });
  const [formError, setFormError] = useState('');

  // Fetch real notification records from backend
  const fetchNotifications = useCallback(() => {
    setLoading(true);
    setError('');

    api.getNotificationsList({ page, limit: 50 })
      .then((res) => {
        setNotifications(res.notifications || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) setPagination(res.pagination);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load notifications history.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Debounced user search when typing in Specific User mode
  useEffect(() => {
    if (targetMode !== 'user' || selectedUser || !userSearchQuery.trim()) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(() => {
      api.searchUsers(userSearchQuery.trim(), 10)
        .then((res) => {
          setUserSearchResults(res.users || []);
        })
        .catch(() => {
          setUserSearchResults([]);
        })
        .finally(() => {
          setIsSearchingUsers(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [userSearchQuery, targetMode, selectedUser]);

  // Keyboard accessibility: Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isSendModalOpen) setIsSendModalOpen(false);
        if (selectedNotification) setSelectedNotification(null);
      }
    };
    if (isSendModalOpen || selectedNotification) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSendModalOpen, selectedNotification]);

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notifications.filter((item) => {
      const matchesSearch =
        !query ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        (item.recipient && item.recipient.toLowerCase().includes(query)) ||
        (item.type && item.type.toLowerCase().includes(query)) ||
        (item.message && item.message.toLowerCase().includes(query));

      const matchesType = !typeFilter || item.type === typeFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [notifications, searchQuery, typeFilter, statusFilter]);

  const handleOpenSendModal = () => {
    setFormData({
      type: 'Daily Reminder',
      title: '',
      message: '',
    });
    setTargetMode('all');
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setFormError('');
    setIsSendModalOpen(true);
  };

  const handleCloseSendModal = () => {
    setIsSendModalOpen(false);
    setFormError('');
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setFormError('');
  };

  const handleRemoveSelectedUser = () => {
    setSelectedUser(null);
    setUserSearchQuery('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (targetMode === 'user' && !selectedUser) {
      setFormError('Please select a specific user to send this notification to.');
      return;
    }

    if (!formData.title.trim()) {
      setFormError('Please enter a notification title.');
      return;
    }

    if (!formData.message.trim()) {
      setFormError('Please enter a notification message body.');
      return;
    }

    setSubmitting(true);

    try {
      const category = CATEGORY_MAP[formData.type] || 'announcement';

      if (targetMode === 'user') {
        // Dispatch to specific user's registered devices
        const response = await api.sendUserPushNotification(selectedUser.id, {
          title: formData.title.trim(),
          message: formData.message.trim(),
          category,
          type: category,
        });

        setIsSendModalOpen(false);
        const recipientName = selectedUser.name || selectedUser.email || 'user';
        setSuccessToast(response.message || `Notification sent successfully to ${recipientName}.`);
      } else {
        // Dispatch to all users via FCM topic broadcast
        const response = await api.sendBroadcastNotification({
          title: formData.title.trim(),
          body: formData.message.trim(),
          category,
        });

        setIsSendModalOpen(false);
        setSuccessToast(response.message || 'Push notification dispatched successfully to all subscribed devices!');
      }

      fetchNotifications();

      setTimeout(() => {
        setSuccessToast('');
      }, 5000);
    } catch (err) {
      // Clean handling for no-token case vs general errors
      if (
        err.noToken ||
        (err.message && err.message.toLowerCase().includes('no registered active device tokens'))
      ) {
        setFormError('This user has no registered mobile device for push notifications.');
      } else {
        setFormError(err.message || 'Failed to dispatch notification.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Sent':
        return <span className="badge-tag badge-success">Sent</span>;
      case 'Failed':
        return <span className="badge-tag badge-danger">Failed</span>;
      case 'Skipped':
      case 'Skipped (No Device)':
        return (
          <span
            className="badge-tag"
            style={{
              background: 'rgba(241, 245, 249, 0.95)',
              color: 'var(--text-muted)',
              border: '1px solid rgba(203, 213, 225, 0.8)',
            }}
          >
            Skipped (No Device)
          </span>
        );
      case 'Pending':
        return <span className="badge-tag badge-warning">Pending</span>;
      default:
        return <span className="badge-tag badge-info">{status}</span>;
    }
  };

  return (
    <div className="content-container">
      {/* Page Header / Toolbar */}
      <div className="toolbar">
        <div className="toolbar-heading">
          <h2 className="toolbar-title">Notifications</h2>
          <p className="toolbar-subtitle">
            Manage and monitor notifications sent to HabitUp users.
          </p>
        </div>

        <div className="filter-group">
          <button
            type="button"
            className="action-btn"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)',
              color: '#ffffff',
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
            onClick={handleOpenSendModal}
          >
            <Plus size={16} aria-hidden="true" />
            <span>Send Notification</span>
          </button>
        </div>
      </div>

      {error && <div className="error-alert">{error}</div>}

      {/* Success Notification Alert */}
      {successToast && (
        <div
          className="fade-in"
          style={{
            background: 'var(--accent-success-light)',
            border: '1px solid rgba(5, 150, 105, 0.25)',
            color: 'var(--accent-success)',
            padding: '0.8rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.84rem',
            fontWeight: 600,
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--neu-shadow-card)',
          }}
          role="status"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-success)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              padding: '0.2rem 0.4rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            aria-label="Dismiss message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <KPICard
          title="TOTAL NOTIFICATIONS"
          value={stats.total}
          icon={<Bell size={18} color="var(--accent-primary)" />}
          badgeText="All Time"
          badgeType="info"
        />
        <KPICard
          title="SENT"
          value={stats.sent}
          icon={<CheckCircle2 size={18} color="var(--accent-success)" />}
          badgeText={stats.total > 0 ? `${Math.round((stats.sent / stats.total) * 100)}% Delivered` : undefined}
          badgeType="success"
        />
        <KPICard
          title="FAILED"
          value={stats.failed}
          icon={<AlertTriangle size={18} color="var(--accent-danger)" />}
          badgeText={stats.failed > 0 ? `${stats.failed} Errors` : undefined}
          badgeType="danger"
        />
        <KPICard
          title="PENDING"
          value={stats.pending}
          icon={<Clock size={18} color="var(--accent-warning)" />}
          badgeText={stats.pending > 0 ? `${stats.pending} Queued` : undefined}
          badgeType="warning"
        />
      </div>

      {/* Search and Filters Toolbar */}
      <div className="toolbar" style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
        <div className="filter-group" style={{ flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', maxWidth: '340px' }}
            placeholder="Search notifications, recipient, or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notifications"
          />

          <select
            className="select-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by notification type"
          >
            <option value="">All Types</option>
            <option value="Daily Reminder">Daily Reminder</option>
            <option value="Friend Request">Friend Request</option>
            <option value="Friend Nudge">Friend Nudge</option>
            <option value="Evening Reminder">Evening Reminder</option>
            <option value="Achievement">Achievement</option>
            <option value="System Notification">System Notification</option>
            <option value="Direct Message">Direct Message</option>
            <option value="motivation">Motivation</option>
            <option value="announcement">Announcement</option>
          </select>

          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="Sent">Sent</option>
            <option value="Failed">Failed</option>
            <option value="Skipped">Skipped (No Device)</option>
            <option value="Pending">Pending</option>
          </select>

          {(searchQuery || typeFilter || statusFilter) && (
            <button
              type="button"
              className="pagination-btn"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('');
                setStatusFilter('');
              }}
              style={{ fontWeight: 600 }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Notifications Table */}
      <div className="table-container fade-in">
        <table className="data-table">
          <thead>
            <tr>
              <th>Notification</th>
              <th>Type</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Sent At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Loading real notifications history from database...
                </td>
              </tr>
            ) : filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-dim)' }}>
                  {notifications.length === 0
                    ? 'No notifications sent yet. Click "+ Send Notification" to create a notification.'
                    : 'No notifications match the selected search or filters.'}
                </td>
              </tr>
            ) : (
              filteredNotifications.map((notif) => (
                <tr key={notif.id} onClick={() => setSelectedNotification(notif)}>
                  <td>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.88rem' }}>
                        {notif.title}
                      </div>
                      {notif.message && (
                        <div
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.2rem',
                            maxWidth: '380px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notif.message}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        background: 'rgba(241, 245, 249, 0.9)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                      }}
                    >
                      {notif.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className="avatar"
                        style={{
                          width: '24px',
                          height: '24px',
                          fontSize: '0.7rem',
                          background: notif.recipient === 'All Users'
                            ? 'linear-gradient(135deg, var(--accent-secondary) 0%, #0284c7 100%)'
                            : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        aria-hidden="true"
                      >
                        {notif.recipient === 'All Users' ? <Users size={13} color="#ffffff" /> : (notif.recipient ? notif.recipient.charAt(0).toUpperCase() : 'U')}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84rem' }}>
                        {notif.recipient}
                      </span>
                    </div>
                  </td>
                  <td>{getStatusBadge(notif.status)}</td>
                  <td className="tabular-nums" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {notif.sentAt}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNotification(notif);
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

      {/* Pagination Footer */}
      <div className="pagination">
        <span>
          Showing <strong>{filteredNotifications.length}</strong> of <strong>{pagination.total || notifications.length}</strong> total records
        </span>

        {pagination.totalPages > 1 && (
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
        )}
      </div>

      {/* Send Notification Modal Dialog */}
      {isSendModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseSendModal}>
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-modal-title"
          >
            <button
              className="modal-close"
              onClick={handleCloseSendModal}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '1rem' }}>
              <h2
                id="send-modal-title"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}
              >
                Send Notification
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Dispatch a push notification via Firebase Cloud Messaging (FCM).
              </p>
            </div>

            {formError && <div className="error-alert" role="alert">{formError}</div>}

            <form onSubmit={handleFormSubmit}>
              {/* Send To Selector */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Send To</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    background: 'var(--bg-input)',
                    padding: '0.35rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(226, 232, 240, 0.85)',
                    boxShadow: 'var(--neu-shadow-inset)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: targetMode === 'all' ? 700 : 500,
                      color: targetMode === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      background: targetMode === 'all' ? '#ffffff' : 'transparent',
                      boxShadow: targetMode === 'all' ? 'var(--neu-shadow-btn)' : 'none',
                      border: targetMode === 'all' ? '1px solid rgba(255, 255, 255, 0.95)' : '1px solid transparent',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="targetMode"
                      value="all"
                      checked={targetMode === 'all'}
                      onChange={() => {
                        setTargetMode('all');
                        setFormError('');
                      }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Users size={15} /> All Users
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: targetMode === 'user' ? 700 : 500,
                      color: targetMode === 'user' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      background: targetMode === 'user' ? '#ffffff' : 'transparent',
                      boxShadow: targetMode === 'user' ? 'var(--neu-shadow-btn)' : 'none',
                      border: targetMode === 'user' ? '1px solid rgba(255, 255, 255, 0.95)' : '1px solid transparent',
                      transition: 'all 0.18s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="targetMode"
                      value="user"
                      checked={targetMode === 'user'}
                      onChange={() => {
                        setTargetMode('user');
                        setFormError('');
                      }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={15} /> Specific User
                    </span>
                  </label>
                </div>
              </div>

              {/* Specific User Search / Selection Field */}
              {targetMode === 'user' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" htmlFor="user-search-input">
                    Select User <span style={{ color: 'var(--accent-danger)' }}>*</span>
                  </label>

                  {selectedUser ? (
                    <div
                      className="neu-inset-tile"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: '#ffffff',
                        border: '1px solid rgba(79, 70, 229, 0.25)',
                        boxShadow: 'var(--neu-shadow-btn)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          className="avatar"
                          style={{
                            width: '36px',
                            height: '36px',
                            fontSize: '0.9rem',
                            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                          }}
                        >
                          {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                              {selectedUser.name || 'Anonymous User'}
                            </span>
                            {selectedUser.username && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                @{selectedUser.username}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {selectedUser.email}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="pagination-btn"
                        onClick={handleRemoveSelectedUser}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', fontWeight: 600 }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        id="user-search-input"
                        type="text"
                        className="form-input"
                        placeholder="Search user by name, @username, or email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        autoFocus
                      />

                      {/* Search Loading Indicator */}
                      {isSearchingUsers && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            padding: '0.4rem 0.5rem',
                            marginTop: '0.2rem',
                          }}
                        >
                          Searching users...
                        </div>
                      )}

                      {/* Search Results Dropdown */}
                      {userSearchResults.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid rgba(226, 232, 240, 0.9)',
                            boxShadow: 'var(--shadow-modal)',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            zIndex: 50,
                            padding: '0.35rem',
                          }}
                        >
                          {userSearchResults.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => handleSelectUser(u)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.6rem 0.75rem',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--accent-primary-light)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div
                                className="avatar"
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  fontSize: '0.75rem',
                                  minWidth: '28px',
                                }}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: 'var(--text-main)',
                                      fontSize: '0.84rem',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {u.name || 'Anonymous User'}
                                  </span>
                                  {u.username && (
                                    <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                      @{u.username}
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.74rem',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {userSearchQuery.trim() && !isSearchingUsers && userSearchResults.length === 0 && (
                        <div
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            padding: '0.45rem 0.5rem',
                            fontStyle: 'italic',
                          }}
                        >
                          No users found matching "{userSearchQuery}".
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notification Type / Category */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-type">
                  Notification Category
                </label>
                <select
                  id="notif-type"
                  className="form-input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Daily Reminder">Daily Reminder (Motivation)</option>
                  <option value="Friend Nudge">Friend Nudge (Encouragement)</option>
                  <option value="Achievement">Achievement (Streak)</option>
                  <option value="System Notification">System Notification (Announcement)</option>
                  <option value="Evening Reminder">Evening Reminder (Habit Tip)</option>
                </select>
              </div>

              {/* Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-title">
                  Title
                </label>
                <input
                  id="notif-title"
                  type="text"
                  maxLength={120}
                  className="form-input"
                  placeholder="e.g. Keep Going!"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  disabled={submitting}
                />
              </div>

              {/* Message */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-message">
                  Message Body
                </label>
                <textarea
                  id="notif-message"
                  className="form-input"
                  rows={4}
                  maxLength={1000}
                  placeholder="Enter notification message body..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{ resize: 'vertical', minHeight: '85px' }}
                  disabled={submitting}
                />
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.75rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid rgba(226, 232, 240, 0.7)',
                }}
              >
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={handleCloseSendModal}
                  style={{ minWidth: '90px' }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn"
                  disabled={submitting}
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)',
                    color: '#ffffff',
                    padding: '0.65rem 1.35rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                    minWidth: '150px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Send size={15} />
                  <span>{submitting ? 'Sending...' : 'Send Notification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Notification Details Modal */}
      {selectedNotification && (
        <div className="modal-backdrop" onClick={() => setSelectedNotification(null)}>
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '560px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelectedNotification(null)}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '1.25rem' }}>
              <div
                className="avatar"
                style={{
                  width: '44px',
                  height: '44px',
                  fontSize: '1.2rem',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <Bell size={20} color="#ffffff" />
              </div>
              <div>
                <h2
                  id="detail-modal-title"
                  style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}
                >
                  {selectedNotification.title}
                </h2>
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span className="badge-tag badge-primary">{selectedNotification.type}</span>
                  {getStatusBadge(selectedNotification.status)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Message Content
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  {selectedNotification.message || 'No additional message body provided.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="neu-inset-tile">
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Recipient
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedNotification.recipient}
                  </div>
                </div>

                <div className="neu-inset-tile">
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Timestamp
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {selectedNotification.sentAt}
                  </div>
                </div>
              </div>

              {selectedNotification.errorReason && (
                <div className="error-alert" style={{ textAlign: 'left', marginBottom: 0 }}>
                  <strong>Failure Reason:</strong> {selectedNotification.errorReason}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setSelectedNotification(null)}
                style={{ fontWeight: 700, padding: '0.5rem 1.25rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
