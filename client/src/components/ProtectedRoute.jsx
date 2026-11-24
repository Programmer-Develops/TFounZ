import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from './ui/Primitives';

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <LoadingState label="Verifying studio session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div style={{ maxWidth: 480, margin: '64px auto', padding: 24 }} className="surface">
        <h2 style={{ fontSize: '1.15rem', marginBottom: 8 }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Your current role (<strong>{user.role}</strong>) does not have permission to open this
          section. Required: <strong>{allowedRoles.join(', ')}</strong>.
        </p>
      </div>
    );
  }

  return children;
}
