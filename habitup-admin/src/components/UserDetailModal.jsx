import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { formatDuration } from '../utils';

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

  useEffect(() => {
    if (!userId) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [userId, onClose]);

  if (!userId) return null;


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">✕</button>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Loading user profile details...
          </div>
        ) : error ? (
          <div className="error-alert">{error}</div>
        ) : userData ? (
          <div>
            {/* Identity & Account Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(226, 232, 240, 0.7)', paddingBottom: '1.25rem' }}>
              <div
                className="avatar"
                style={{ width: '48px', height: '48px', fontSize: '1.3rem' }}
                aria-hidden="true"
              >
                {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                    {userData.name}
                  </h2>
                  {userData.username && (
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      @{userData.username}
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.1rem' }}>{userData.email}</div>
                <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.45rem' }}>
                  <span className={`badge-tag badge-${userData.role === 'admin' ? 'info' : 'primary'}`}>
                    {userData.role}
                  </span>
                  <span className={`badge-tag badge-${userData.deleted_at ? 'danger' : 'success'}`}>
                    {userData.deleted_at ? 'Deleted' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Dates & Core Statistics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.85rem',
                marginBottom: '1.75rem',
              }}
            >
              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>JOINED DATE</div>
                <div className="tabular-nums" style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {new Date(userData.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>TIMEZONE</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {userData.timezone || 'UTC'}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>HABITS</div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                  {userData.total_habits ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>COMPLETIONS</div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
                  {userData.total_completions ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>CURRENT STREAK</div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-warning)', marginTop: '0.2rem' }}>
                  {userData.current_streak_max ?? 0}d
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>BEST STREAK</div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--accent-secondary)', marginTop: '0.2rem' }}>
                  {userData.best_streak_max ?? 0}d
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>SESSIONS</div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                  {userData.total_sessions ?? 0}
                </div>
              </div>

              <div className="neu-inset-tile">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>EST. USAGE</div>
                <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {formatDuration(userData.estimated_total_usage_seconds)}
                </div>
              </div>
            </div>

            {/* Recent Activity Audit Table */}
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, marginBottom: '0.85rem', color: 'var(--text-main)', letterSpacing: '-0.2px' }}>
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
                        <td className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(act.created_at).toLocaleString()}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
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
