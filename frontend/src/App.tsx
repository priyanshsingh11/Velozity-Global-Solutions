import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Role } from './types';

import AppLayout from './components/AppLayout';
import { LoadingSpinner } from './components/ui';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TasksPage from './pages/TasksPage';
import ActivityPage from './pages/ActivityPage';
import ClientsPage from './pages/ClientsPage';
import UsersPage from './pages/UsersPage';

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <LoadingSpinner message="Restoring session..." />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="p-4 rounded-2xl bg-red-500/10 text-red-400">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-semibold text-white">403 — Access Denied</h3>
      <p className="text-slate-500 text-sm max-w-sm">
        Your role does not grant access to this page. Note that this is only a UX guard — the API
        enforces the same rule server-side.
      </p>
    </div>
  );
}

/**
 * Gates a route on an authenticated session and, optionally, on role.
 * This is a *convenience* layer only: every endpoint behind these pages
 * re-checks identity, role and resource ownership on the server.
 */
function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <AppLayout>{roles && !roles.includes(user.role) ? <AccessDenied /> : children}</AppLayout>;
}

function LoginRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullPageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route
        path="/dashboard"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/projects"
        element={
          <Protected>
            <ProjectsPage />
          </Protected>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <Protected>
            <ProjectDetailPage />
          </Protected>
        }
      />
      <Route
        path="/tasks"
        element={
          <Protected>
            <TasksPage />
          </Protected>
        }
      />
      <Route
        path="/activity"
        element={
          <Protected>
            <ActivityPage />
          </Protected>
        }
      />
      <Route
        path="/clients"
        element={
          <Protected roles={['ADMIN', 'PM']}>
            <ClientsPage />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected roles={['ADMIN']}>
            <UsersPage />
          </Protected>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
