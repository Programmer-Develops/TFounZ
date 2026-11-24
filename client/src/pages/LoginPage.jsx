import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { ErrorBanner, Field } from '../components/ui/Primitives';

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main className="container" style={{ paddingTop: 64, paddingBottom: 64 }}>
        <div className="surface-padded" style={{ maxWidth: 420, margin: '0 auto', padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Creator Access
            </div>
            <h1 style={{ fontSize: '1.5rem' }}>Sign in to TFounZ</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>
              Enter your studio account to create shows or join a live broadcast.
            </p>
          </div>

          <div style={{ marginBottom: error ? 16 : 0 }}>
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email Address" htmlFor="login-email">
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              style={{ marginTop: 6, width: '100%' }}
            >
              <LogIn size={15} /> {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p
            style={{
              marginTop: 20,
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
            }}
          >
            New to TFounZ Studio?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
