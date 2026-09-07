import React from 'react';

export function Sidebar({ currentTab, setCurrentTab, isCollapsed, isMobileOpen, setIsMobileOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'activity', label: 'Activity', icon: '⚡' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
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
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                title={item.label}
                aria-current={currentTab === item.id ? 'page' : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span>HabitUp Platform</span>
        <span>v2.0</span>
      </div>
    </aside>
  );
}
