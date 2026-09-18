import React from 'react';
import {
  LayoutDashboard,
  Users,
  Zap,
  Bell,
  BarChart3,
  FlaskConical,
} from 'lucide-react';

export function Sidebar({ currentTab, setCurrentTab, isCollapsed, isMobileOpen, setIsMobileOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'activity', label: 'Activity', icon: Zap },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'experiments', label: 'Experiments', icon: FlaskConical },
  ];

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">H</div>
        <span className="logo-text">HabitUp</span>
        <span className="logo-badge">Admin</span>
      </div>

      <nav aria-label="Admin Navigation">
        <ul className="nav-list">
          {navItems.map((item) => {
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
      </nav>

      <div className="sidebar-footer">
        <span>HabitUp Platform</span>
        <span>v2.0</span>
      </div>
    </aside>
  );
}
