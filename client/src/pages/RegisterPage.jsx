import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { ErrorBanner, Field } from '../components/ui/Primitives';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'host',
    bio: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />
      <main className="container" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <div className="surface-padded" style={{ maxWidth: 460, margin: '0 auto', padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              New Creator Account
            </div>
            <h1 style={{ fontSize: '1.5rem' }}>Join TFounZ Studio</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', marginTop: 4 }}>
              Select <strong>Host</strong> to produce shows or <strong>Participant</strong> to join live rooms.
            </p>
          </div>

          <div style={{ marginBottom: error ? 16 : 0 }}>
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full Name" htmlFor="reg-name">
              <input
                id="reg-name"
                required
                minLength={2}
                className="input"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>

            <Field label="Email Address" htmlFor="reg-email">
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>

            <div className="grid-2">
              <Field label="Password" htmlFor="reg-password">
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="input"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </Field>

              <Field label="Studio Role" htmlFor="reg-role">
                <select
                  id="reg-role"
                  className="select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="host">Host (Create Shows)</option>
                  <option value="participant">Participant (Guest)</option>
                </select>
              </Field>
            </div>

            <Field label="Creator Tagline (Optional)" htmlFor="reg-bio">
              <input
                id="reg-bio"
                maxLength={240}
                className="input"
                placeholder="Host, filmmaker, or developer"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={submitting}
              style={{ marginTop: 6, width: '100%' }}
            >
              <UserPlus size={15} /> {submitting ? 'Creating account...' : 'Create Account'}
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
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
