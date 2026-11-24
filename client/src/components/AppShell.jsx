import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  PlusCircle,
  Users,
  Film,
  Archive,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';

export default function AppShell({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const { health } = useStudio();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickCode, setQuickCode] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleQuickJoin = (e) => {
    e.preventDefault();
    const cleaned = quickCode.trim().toUpperCase();
    if (!cleaned) return;
    setQuickCode('');
    navigate(`/room/${cleaned}`);
  };

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutGrid },
    { to: '/shows/new', label: 'Create Show', icon: PlusCircle },
    { to: '/guests', label: 'AI Guest Library', icon: Users },
    { to: '/studio', label: 'Productions', icon: Film },
    { to: '/history', label: 'Show Archive', icon: Archive },
    { to: '/profile', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="app-shell">
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 25,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`studio-rail ${mobileOpen ? 'open' : ''}`}>
        <div className="rail-brand">
          <Link
            to="/dashboard"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}
            onClick={() => setMobileOpen(false)}
          >
            <div className="rail-brand-mark">
              <Radio size={15} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                TFounZ
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Talk Show Studio</div>
            </div>
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm mobile-only"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="rail-section-label">Workspace</div>
        <nav className="rail-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `rail-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Shield size={16} strokeWidth={1.8} />
              <span>Admin Console</span>
            </NavLink>
          )}
        </nav>

        <div className="rail-footer">
          {/* Compact Engine Health */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              fontSize: '0.74rem',
            }}
          >
            <div className="eyebrow" style={{ fontSize: '0.64rem' }}>
              Production Engines
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>SounZ Audio</span>
              <span
                style={{
                  fontWeight: 500,
                  color: health.sounzAi?.online ? 'var(--status-positive)' : 'var(--status-warn)',
                }}
              >
                {health.sounzAi?.online ? 'Ready' : 'Standby'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Filmy Director</span>
              <span
                style={{
                  fontWeight: 500,
                  color: health.filmyAi?.online ? 'var(--status-positive)' : 'var(--status-warn)',
                }}
              >
                {health.filmyAi?.online ? 'Ready' : 'Standby'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '4px 6px',
            }}
          >
            <Link to="/profile" style={{ minWidth: 0 }} onClick={() => setMobileOpen(false)}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                {user?.role}
              </div>
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm mobile-only"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <form onSubmit={handleQuickJoin} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                className="input mono"
                style={{ height: 32, width: 190, fontSize: '0.78rem', padding: '0 10px' }}
                placeholder="Join code (TFZ-...)"
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value)}
              />
              {quickCode.trim() && (
                <button type="submit" className="btn btn-secondary btn-sm">
                  Join <ArrowRight size={13} />
                </button>
              )}
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/shows/new" className="btn btn-primary btn-sm">
              <PlusCircle size={14} /> New Show
            </Link>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
