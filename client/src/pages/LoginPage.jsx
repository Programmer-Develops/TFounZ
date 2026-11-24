import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email) => {
    setForm({ email, password: 'Password123!' });
  };

  return (
    <div className="container page-shell">
      <div className="card" style={{ maxWidth: 460, margin: '28px auto' }}>
        <div style={{ marginBottom: 20 }}>
          <span className="badge badge-gold" style={{ marginBottom: 10 }}>
            <Sparkles size={12} /> Studio Backstage Pass
          </span>
          <h1 style={{ fontSize: '1.75rem' }}>Sign In to TFounZ</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Enter the Control Room, host shows, or join with a live show code.
          </p>
        </div>

        {error && (
          <div className="alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              className="input"
              placeholder="host@tfounz.studio"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 6 }}>
            <LogIn size={16} /> {submitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div
          className="glass-panel"
          style={{ marginTop: 18, padding: '12px 14px', fontSize: '0.82rem' }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
            Quick Fill Seeded Demo Accounts (<span className="mono">Password123!</span>):
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillDemo('host@tfounz.studio')}>
              Host
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillDemo('guest@tfounz.studio')}>
              Participant
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fillDemo('admin@tfounz.studio')}>
              Admin
            </button>
          </div>
        </div>

        <p style={{ marginTop: 18, fontSize: '0.88rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          New to TFounZ Studio?{' '}
          <Link to="/register" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
