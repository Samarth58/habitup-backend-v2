import React from 'react';
import {
  LayoutDashboard,
  Users,
  Zap,
  Bell,
  BarChart3,
  FlaskConical,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'activity', label: 'Activity', icon: Zap },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'experiments', label: 'Experiments', icon: FlaskConical },
    ],
  },
];

export function Sidebar({ currentTab, setCurrentTab, isCollapsed, isMobileOpen, setIsMobileOpen }) {
  const { user, logout } = useAuth();

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileOpen && setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        <div className="sidebar-logo">
          <div className="logo-icon" aria-hidden="true">H</div>
          <div className="logo-brand">
            <span className="logo-text">HabitUp</span>
            <span className="logo-sub">Admin Console</span>
          </div>
        </div>

        <nav aria-label="Admin Navigation">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label" aria-hidden="true">
                {section.label}
              </div>
              <ul className="nav-list">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
                        onClick={() => handleNavClick(item.id)}
                        title={item.label}
                        aria-current={currentTab === item.id ? 'page' : undefined}
                      >
                        <span className="nav-icon" aria-hidden="true">
                          <Icon size={18} />
                        </span>
                        <span className="nav-text">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar" aria-hidden="true">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name">{user?.name || 'Administrator'}</span>
              <span className="sidebar-user-role">{user?.role || 'admin'}</span>
            </div>
          </div>

          <button
            className="sidebar-logout"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  );
}
