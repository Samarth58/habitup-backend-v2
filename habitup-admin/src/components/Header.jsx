import React from 'react';
import { useAuth } from '../context/AuthContext';

export function Header({ title }) {
  const { user, logout, lastHeartbeat } = useAuth();

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>

      <div className="header-actions">
        {lastHeartbeat && (
          <div className="heartbeat-badge" title="Session Heartbeat Active">
            <div className="heartbeat-dot"></div>
            <span>Heartbeat: {lastHeartbeat}</span>
          </div>
        )}

        <div className="user-profile-badge">
          <div className="avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Admin User'}</span>
            <span className="user-role">{user?.role || 'admin'}</span>
          </div>
        </div>

        <button className="logout-btn" onClick={logout} title="Sign Out">
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
