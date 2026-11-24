import React from 'react';
import { Link } from 'react-router-dom';
import { Radio, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Clean public navigation bar used on Landing, Login, and Register screens.
 */
export default function Navbar() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="public-nav">
      <div className="container public-nav-inner">
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="rail-brand-mark">
            <Radio size={15} strokeWidth={2.2} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.96rem', letterSpacing: '-0.02em' }}>
            TFounZ <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Studio</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Open Studio <ArrowRight size={14} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Create Account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
