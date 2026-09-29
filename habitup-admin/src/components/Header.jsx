import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Header({ title, description, onToggleCollapse }) {
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
            <Menu size={18} aria-hidden="true" />
          </button>
        )}

        <div className="header-heading">
          <h1 className="header-title">{title}</h1>
          {description && <p className="header-description">{description}</p>}
        </div>
      </div>

      <div className="header-actions">
        {lastHeartbeat && (
          <div className="heartbeat-badge" title="Live session heartbeat active">
            <div className="heartbeat-dot" aria-hidden="true"></div>
            <span className="tabular-nums">Live &bull; {lastHeartbeat}</span>
          </div>
        )}

        <div className="user-profile-badge">
          <div className="avatar" aria-hidden="true">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'Admin'}</span>
            <span className="user-role">{user?.role || 'admin'}</span>
          </div>
        </div>

        <button className="logout-btn" onClick={logout} title="Sign Out">
          <LogOut size={15} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
