import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ActivityPage } from './pages/ActivityPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import './App.css';

function MainLayout() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (isInitializing) {
    return (
      <div className="boot-screen" role="status">
        <div className="logo-icon" aria-hidden="true">H</div>
        <p>Initializing Admin Dashboard&hellip;</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'users':
        return <UsersPage />;
      case 'activity':
        return <ActivityPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'experiments':
        return <ExperimentsPage />;
      default:
        return <DashboardPage />;
    }
  };

  const getTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Overview';
      case 'users': return 'Users';
      case 'activity': return 'Activity';
      case 'notifications': return 'Notifications';
      case 'analytics': return 'Analytics';
      case 'experiments': return 'Experiments';
      default: return 'HabitUp Admin';
    }
  };

  const getDescription = () => {
    switch (currentTab) {
      case 'dashboard': return 'Real-time operational snapshot of the HabitUp ecosystem';
      case 'users': return 'Search, filter and manage every HabitUp account';
      case 'activity': return 'Audit trail of user and system events';
      case 'notifications': return 'Compose, dispatch and monitor push notifications';
      case 'analytics': return 'Engagement, usage trends and session breakdowns';
      case 'experiments': return 'A/B experiment results and statistical readouts';
      default: return 'HabitUp administration console';
    }
  };

  return (
    <div className="admin-app">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <main className="main-content">
        <Header
          title={getTitle()}
          description={getDescription()}
          onToggleCollapse={() => {
            if (window.innerWidth <= 768) {
              setIsMobileOpen(!isMobileOpen);
            } else {
              setIsCollapsed(!isCollapsed);
            }
          }}
        />
        {renderContent()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
