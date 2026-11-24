import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StudioProvider } from './context/StudioContext';
import { ToastProvider } from './context/ToastContext';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import CreateShowPage from './pages/CreateShowPage';
import GuestLibraryPage from './pages/GuestLibraryPage';
import ShowRoomPage from './pages/ShowRoomPage';
import PostProductionPage from './pages/PostProductionPage';
import HistoryPage from './pages/HistoryPage';
import AttendanceReportPage from './pages/AttendanceReportPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

function WorkspaceRoute({ children, allowedRoles = null }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ToastProvider>
        <AuthProvider>
          <StudioProvider>
            <ErrorBoundary>
              <Routes>
              {/* Public Editorial Pages */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated Creator Workspace (Persistent Studio Rail) */}
              <Route
                path="/dashboard"
                element={
                  <WorkspaceRoute>
                    <DashboardPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/shows/new"
                element={
                  <WorkspaceRoute>
                    <CreateShowPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/guests"
                element={
                  <WorkspaceRoute>
                    <GuestLibraryPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/studio"
                element={
                  <WorkspaceRoute>
                    <PostProductionPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/studio/:meetingId"
                element={
                  <WorkspaceRoute>
                    <PostProductionPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <WorkspaceRoute>
                    <HistoryPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/meetings/:id/report"
                element={
                  <WorkspaceRoute allowedRoles={['host', 'admin']}>
                    <AttendanceReportPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <WorkspaceRoute>
                    <ProfileSettingsPage />
                  </WorkspaceRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <WorkspaceRoute allowedRoles={['admin']}>
                    <AdminDashboardPage />
                  </WorkspaceRoute>
                }
              />

              {/* Full-Viewport Distraction-Free Virtual Production Studio */}
              <Route
                path="/room/:code"
                element={
                  <ProtectedRoute>
                    <ShowRoomPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ErrorBoundary>
          </StudioProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
