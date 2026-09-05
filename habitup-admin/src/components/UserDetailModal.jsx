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
        <button className="modal-close" onClick={onClose}>✕</button>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading user profile...
          </div>
        ) : error ? (
          <div className="error-alert">{error}</div>
        ) : userData ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                className="avatar"
                style={{ width: '50px', height: '50px', fontSize: '1.4rem' }}
              >
                {userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{userData.name}</h2>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{userData.email}</span>
                <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge-tag badge-${userData.role === 'admin' ? 'info' : 'success'}`}>
                    {userData.role}
                  </span>
                  <span className={`badge-tag badge-${userData.deleted_at ? 'danger' : 'success'}`}>
                    {userData.deleted_at ? 'Deleted' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TIMEZONE</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {userData.timezone || 'UTC'}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JOINED DATE</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {new Date(userData.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL HABITS</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-primary)', marginTop: '0.2rem' }}>
                  {userData.total_habits}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>COMPLETIONS</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-success)', marginTop: '0.2rem' }}>
                  {userData.total_completions}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CURRENT STREAK MAX</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-warning)', marginTop: '0.2rem' }}>
                  {userData.current_streak_max ?? 0} days
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>BEST STREAK MAX</div>
                <div style={{ fontWeight: 600, fontSize: '1.2rem', color: 'var(--accent-secondary)', marginTop: '0.2rem' }}>
                  {userData.best_streak_max ?? 0} days
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESTIMATED USAGE</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {formatDuration(userData.estimated_total_usage_seconds)}
                </div>
              </div>

              <div className="glass-card" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL SESSIONS</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {userData.total_sessions ?? 0}
                </div>
              </div>
            </div>

            {/* Recent Activity Log */}
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              Recent User Activity
            </h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Date & Time</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.recent_activity && userData.recent_activity.length > 0 ? (
                    userData.recent_activity.map((act) => (
                      <tr key={act.id}>
                        <td>
                          <span className="badge-tag badge-info">{act.activity_type}</span>
                        </td>
                        <td>{new Date(act.created_at).toLocaleString()}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {act.metadata ? JSON.stringify(act.metadata) : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
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
