import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

export function UserDetailModal({ userId, onClose }) {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError('');

    api.getUserDetail(userId)
      .then((res) => {
        setUserData(res.user);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load user details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  if (!userId) return null;

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading user profile...
          </div>
        ) : error ? (
          <div className="error-alert">{error}</div>
        ) : userData ? (
          <div>
            {/* 1 & 2. User Identity & Account Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(218, 226, 237, 0.6)', paddingBottom: '1.25rem' }}>
              <div
                className="avatar"
                style={{ width: '48px', height: '48px', fontSize: '1.3rem' }}
              >
                {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>{userData.name}</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{userData.email}</div>
                <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.45rem' }}>
                  <span className={`badge-tag badge-${userData.role === 'admin' ? 'info' : 'primary'}`}>
                    {userData.role}
                  </span>
                  <span className={`badge-tag badge-${userData.deleted_at ? 'danger' : 'success'}`}>
                    {userData.deleted_at ? 'Deleted' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3 to 9. Account Dates & Core Statistics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.75rem',
              }}
            >
              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>JOINED DATE</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {new Date(userData.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>TIMEZONE</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {userData.timezone || 'UTC'}
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>HABITS</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                  {userData.total_habits ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>COMPLETIONS</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
                  {userData.total_completions ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>CURRENT STREAK</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-warning)', marginTop: '0.2rem' }}>
                  {userData.current_streak_max ?? 0}d
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>BEST STREAK</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--accent-secondary)', marginTop: '0.2rem' }}>
                  {userData.best_streak_max ?? 0}d
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>SESSIONS</div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {userData.total_sessions ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile" style={{ padding: '0.85rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>EST. USAGE</div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {formatDuration(userData.estimated_total_usage_seconds)}
                </div>
              </div>
            </div>

            {/* 10. Recent Activity Log */}
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              Recent Activity Audit
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Timestamp</th>
                    <th>Metadata Context</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.recent_activity && userData.recent_activity.length > 0 ? (
                    userData.recent_activity.map((act) => (
                      <tr key={act.id}>
                        <td>
                          <span className="badge-tag badge-info">{act.activity_type}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(act.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-dim)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.metadata ? JSON.stringify(act.metadata) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                        No recent activity recorded for this user.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
