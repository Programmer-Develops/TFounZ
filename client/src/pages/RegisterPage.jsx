import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
    <div className="container page-shell">
      <div className="card" style={{ maxWidth: 490, margin: '20px auto' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>Create Studio Account</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 18 }}>
          Choose <strong>Host</strong> to launch AI Talk Shows &amp; meetings, or{' '}
          <strong>Participant</strong> to join as a live guest.
        </p>

        {error && (
          <div className="alert-error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="field-label" htmlFor="reg-name">
              Full Name
            </label>
            <input
              id="reg-name"
              required
              minLength={2}
              className="input"
              placeholder="Shantanu Pandya"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="reg-email">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid-2">
            <div>
              <label className="field-label" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={6}
                className="input"
                placeholder="Min 6 chars"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="reg-role">
                Studio Role
              </label>
              <select
                id="reg-role"
                className="select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="host">Host (Create &amp; Run Shows)</option>
                <option value="participant">Participant (Guest / Audience)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="reg-bio">
              Guest / Host Tagline (Optional)
            </label>
            <input
              id="reg-bio"
              maxLength={240}
              className="input"
              placeholder="Full-stack builder & talk show enthusiast"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: 6 }}>
            <UserPlus size={16} /> {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: 18, fontSize: '0.88rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Already registered?{' '}
          <Link to="/login" style={{ color: 'var(--accent-gold)', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
