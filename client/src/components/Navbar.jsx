import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Tv, LayoutDashboard, Film, History, Shield, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStudio } from '../context/StudioContext';

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const { health } = useStudio();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f5b041, #ff4d6d)',
              display: 'grid',
              placeItems: 'center',
              color: '#140f08',
            }}
          >
            <Tv size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.08rem', lineHeight: 1.1 }}>
              TFounZ <span style={{ color: 'var(--accent-gold)' }}>Studio</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              AI Talk Show &amp; MeetLite
            </div>
          </div>
        </Link>

        {isAuthenticated ? (
          <>
            <nav className="nav-links">
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <LayoutDashboard size={16} /> Control Room
              </NavLink>
              <NavLink to="/studio" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Film size={16} /> Post-Production
              </NavLink>
              <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <History size={16} /> Shows &amp; Reports
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Shield size={16} /> Admin
                </NavLink>
              )}
            </nav>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                className={`badge ${health.sounzAi?.online ? 'badge-emerald' : 'badge-gold'}`}
                title="SounZ AI Hugging Face Space"
              >
                <Sparkles size={12} /> SounZ {health.sounzAi?.online ? 'Live' : 'Standby'}
              </span>
              <span
                className={`badge ${health.filmyAi?.online ? 'badge-cyan' : 'badge-gold'}`}
                title="Filmy AI Hugging Face Space"
              >
                Filmy {health.filmyAi?.online ? 'Live' : 'Standby'}
              </span>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{user.name}</span>
                <span className="badge badge-violet" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                  {user.role}
                </span>
              </div>

              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                <LogOut size={15} /> Logout
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/login" className="btn btn-ghost btn-sm">
              Sign In
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              Enter Studio
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
