import React from 'react';

export function Sidebar({ currentTab, setCurrentTab, isOpen, setIsOpen }) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'activity', label: 'Activity Audit', icon: '⚡' },
    { id: 'analytics', label: 'Usage & Analytics', icon: '📈' },
  ];

  const handleNavClick = (id) => {
    setCurrentTab(id);
    if (setIsOpen) {
      setIsOpen(false);
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">H</div>
        <span className="logo-text">HabitUp</span>
        <span className="logo-badge">Admin</span>
      </div>

      <nav>
        <ul className="nav-list">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${currentTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
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
