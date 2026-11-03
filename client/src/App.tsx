import React, { useState } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './pages/auth/LoginPage.tsx';
import { WorkerDashboard } from './pages/worker/WorkerDashboard.tsx';
import { Layout } from './components/layout/Layout.tsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx';
import { AttendanceMonitoring } from './pages/admin/AttendanceMonitoring.tsx';
import { WorkerManagement } from './pages/admin/WorkerManagement.tsx';
import { ReportsPage } from './pages/admin/ReportsPage.tsx';
import { DepartmentManagement } from './pages/admin/DepartmentManagement.tsx';
import { SettingsPage } from './pages/admin/SettingsPage.tsx';
import { AuditLogsPage } from './pages/admin/AuditLogsPage.tsx';
import { AdminManagement } from './pages/admin/AdminManagement.tsx';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard.tsx';
import { Logo } from './components/common/Logo.tsx';

export const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [adminTab, setAdminTab] = useState<string>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <Logo size="lg" light={true} />
        <div className="mt-8 flex items-center gap-3 text-teal-400 text-sm font-semibold">
          <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <span>Connecting to factory attendance network...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!user) {
    return <LoginPage />;
  }

  // 1. Worker Role: Render ultra-simple mobile-first interface
  if (user.role === 'WORKER') {
    return <WorkerDashboard />;
  }

  // 2. Supervisor Role: Render Supervisor Department Dashboard
  if (user.role === 'SUPERVISOR') {
    return (
      <Layout currentTab={adminTab} onSelectTab={setAdminTab}>
        {adminTab === 'reports' ? (
          <ReportsPage />
        ) : adminTab === 'attendance' ? (
          <AttendanceMonitoring />
        ) : adminTab === 'workers' ? (
          <WorkerManagement />
        ) : (
          <SupervisorDashboard />
        )}
      </Layout>
    );
  }

  // 3. Admin Role: Full enterprise dashboard with all controls
  return (
    <Layout currentTab={adminTab} onSelectTab={setAdminTab}>
      {adminTab === 'dashboard' && <AdminDashboard onNavigateTab={setAdminTab} />}
      {adminTab === 'attendance' && <AttendanceMonitoring />}
      {adminTab === 'workers' && <WorkerManagement />}
      {adminTab === 'reports' && <ReportsPage />}
      {adminTab === 'departments' && <DepartmentManagement />}
      {adminTab === 'admins' && <AdminManagement />}
      {adminTab === 'settings' && <SettingsPage />}
      {adminTab === 'audit' && <AuditLogsPage />}
    </Layout>
  );
};

export default function App() {
  return <AppContent />;
}
