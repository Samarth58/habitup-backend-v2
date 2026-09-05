import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ActivityPage } from './pages/ActivityPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import './App.css';

function MainLayout() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        Initializing Admin Dashboard...
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
      case 'analytics':
        return <AnalyticsPage />;
      default:
        return <DashboardPage />;
    }
  };

  const getTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Overview & Key Metrics';
      case 'users': return 'User Accounts Management';
      case 'activity': return 'Audit & Activity Log';
      case 'analytics': return 'Usage Analytics & Trends';
      default: return 'HabitUp Dashboard';
    }
  };

  return (
    <div className="admin-app">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="main-content">
        <Header title={getTitle()} />
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
