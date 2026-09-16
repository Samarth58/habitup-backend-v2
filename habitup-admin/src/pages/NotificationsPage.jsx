import React, { useState, useMemo, useEffect } from 'react';
import { KPICard } from '../components/KPICard';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [successToast, setSuccessToast] = useState('');

  // Form state for Send Notification modal
  const [formData, setFormData] = useState({
    type: 'Daily Reminder',
    recipients: 'All Users',
    selectedUser: '',
    title: '',
    message: '',
  });
  const [formError, setFormError] = useState('');

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

  // Statistics calculation
  const stats = useMemo(() => {
    const total = notifications.length;
    const sent = notifications.filter((n) => n.status === 'Sent').length;
    const failed = notifications.filter((n) => n.status === 'Failed').length;
    const pending = notifications.filter((n) => n.status === 'Pending').length;
    return { total, sent, failed, pending };
  }, [notifications]);

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notifications.filter((item) => {
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.recipient.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        (item.message && item.message.toLowerCase().includes(query));

      const matchesType = !typeFilter || item.type === typeFilter;
      const matchesStatus = !statusFilter || item.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [notifications, searchQuery, typeFilter, statusFilter]);

  const handleOpenSendModal = () => {
    setFormData({
      type: 'Daily Reminder',
      recipients: 'All Users',
      selectedUser: '',
      title: '',
      message: '',
    });
    setFormError('');
    setIsSendModalOpen(true);
  };

  const handleCloseSendModal = () => {
    setIsSendModalOpen(false);
    setFormError('');
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Please enter a notification title.');
      return;
    }

    if (!formData.message.trim()) {
      setFormError('Please enter a notification message.');
      return;
    }

    if (formData.recipients === 'Selected User' && !formData.selectedUser.trim()) {
      setFormError('Please specify the recipient user account.');
      return;
    }

    const newNotif = {
      id: `notif-${Date.now()}`,
      title: formData.title.trim(),
      message: formData.message.trim(),
      type: formData.type,
      recipient: formData.recipients === 'Selected User' ? formData.selectedUser.trim() : 'All Users',
      recipientType: formData.recipients === 'Selected User' ? 'single' : 'all',
      status: 'Sent',
      sentAt: 'Just now',
      timestamp: Date.now(),
    };

    setNotifications((prev) => [newNotif, ...prev]);
    setIsSendModalOpen(false);
    setSuccessToast(`Notification "${newNotif.title}" was successfully queued.`);

    const timer = setTimeout(() => {
      setSuccessToast('');
    }, 4500);
    return () => clearTimeout(timer);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Sent':
        return <span className="badge-tag badge-success">Sent</span>;
      case 'Failed':
        return <span className="badge-tag badge-danger">Failed</span>;
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
            <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>
            <span>Send Notification</span>
          </button>
        </div>
      </div>

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
            <span aria-hidden="true">✓</span>
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
            }}
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <KPICard
          title="TOTAL NOTIFICATIONS"
          value={stats.total}
          icon="🔔"
          badgeText="All Time"
          badgeType="info"
        />
        <KPICard
          title="SENT"
          value={stats.sent}
          icon="✅"
          badgeText={stats.total > 0 ? `${Math.round((stats.sent / stats.total) * 100)}% Delivered` : undefined}
          badgeType="success"
        />
        <KPICard
          title="FAILED"
          value={stats.failed}
          icon="⚠️"
          badgeText={stats.failed > 0 ? `${stats.failed} Errors` : undefined}
          badgeType="danger"
        />
        <KPICard
          title="PENDING"
          value={stats.pending}
          icon="⏳"
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
            {filteredNotifications.length === 0 ? (
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
                        }}
                        aria-hidden="true"
                      >
                        {notif.recipient === 'All Users' ? '👥' : notif.recipient.charAt(0).toUpperCase()}
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
          Showing <strong>{filteredNotifications.length}</strong> of <strong>{notifications.length}</strong> total records
        </span>
      </div>

      {/* Send Notification Modal Dialog */}
      {isSendModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseSendModal}>
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '560px' }}
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
              ✕
            </button>

            <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '1rem' }}>
              <h2
                id="send-modal-title"
                style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}
              >
                Send Notification
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Broadcast a push notification to HabitUp users.
              </p>
            </div>

            {formError && <div className="error-alert" role="alert">{formError}</div>}

            <form onSubmit={handleFormSubmit}>
              {/* Notification Type */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-type">
                  Notification Type
                </label>
                <select
                  id="notif-type"
                  className="form-input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Daily Reminder">Daily Reminder</option>
                  <option value="Friend Request">Friend Request</option>
                  <option value="Friend Nudge">Friend Nudge</option>
                  <option value="Achievement">Achievement</option>
                  <option value="System Notification">System Notification</option>
                </select>
              </div>

              {/* Recipients */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-recipients">
                  Recipients
                </label>
                <select
                  id="notif-recipients"
                  className="form-input"
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                >
                  <option value="All Users">All Users</option>
                  <option value="Selected User">Selected User</option>
                </select>
              </div>

              {/* Conditional Selected User Input */}
              {formData.recipients === 'Selected User' && (
                <div className="form-group fade-in">
                  <label className="form-label" htmlFor="notif-user">
                    User Account / Username
                  </label>
                  <input
                    id="notif-user"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Samarth or @username"
                    value={formData.selectedUser}
                    onChange={(e) => setFormData({ ...formData, selectedUser: e.target.value })}
                  />
                </div>
              )}

              {/* Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-title">
                  Title
                </label>
                <input
                  id="notif-title"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Don't break your streak!"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* Message */}
              <div className="form-group">
                <label className="form-label" htmlFor="notif-message">
                  Message
                </label>
                <textarea
                  id="notif-message"
                  className="form-input"
                  rows={4}
                  placeholder="Enter notification message..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  style={{ resize: 'vertical', minHeight: '85px' }}
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
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-hover) 100%)',
                    color: '#ffffff',
                    padding: '0.65rem 1.35rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                    minWidth: '150px',
                  }}
                >
                  Send Notification
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
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '1.25rem' }}>
              <div
                className="avatar"
                style={{ width: '44px', height: '44px', fontSize: '1.2rem', minWidth: '44px' }}
                aria-hidden="true"
              >
                🔔
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
                  {selectedNotification.message || 'No additional message text provided.'}
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
