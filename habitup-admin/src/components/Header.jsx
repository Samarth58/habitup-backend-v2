import React from 'react';
import { useAuth } from '../context/AuthContext';

export function Header({ title, onToggleCollapse, onToggleMobile }) {
  const { user, logout, lastHeartbeat } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        {onToggleCollapse && (
          <button
            className="collapse-btn"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar collapse"
            title="Toggle Sidebar"
          >
            ☰
          </button>
        )}
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-actions">
        {lastHeartbeat && (
          <div className="heartbeat-badge" title="Live Session Heartbeat Active">
            <div className="heartbeat-dot"></div>
            <span>Live • {lastHeartbeat}</span>
          </div>
        )}

        <div className="user-profile-badge">
          <div className="avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Admin'}</span>
            <span className="user-role">{user?.role || 'admin'}</span>
          </div>
        </div>

        <button className="logout-btn" onClick={logout} title="Sign Out">
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
