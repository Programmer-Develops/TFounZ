import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container page-shell" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Connecting to TFounZ Studio...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="container page-shell">
        <div className="card" style={{ maxWidth: 540, margin: '40px auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 10 }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 18 }}>
            Your current role (<strong>{user.role}</strong>) cannot view this page. Required:{' '}
            <strong>{allowedRoles.join(', ')}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
