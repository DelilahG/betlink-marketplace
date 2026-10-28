import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError, errorMessage, type User } from '../api';
import { useAuth } from '../auth';
import { Alert, Field, Spinner } from '../components/ui';

/**
 * Only allow same-site relative redirects after login (prevents open redirects). Browsers treat "\" like "/",
 * so "/\evil.com" would become "//evil.com"; backslashes and control characters are rejected outright.
 */
export const safeNext = (next: string | null) =>
  next && /^\/(?![/\\])/.test(next) && !/[\\\x00-\x1f\x7f]/.test(next) ? next : null;

function AuthShell({ title, sub, children }: { title: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-media">
        <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80" alt="" />
      </div>
      <div className="auth-form">
        <h1 className="h1">{title}</h1>
        <p className="muted" style={{ margin: '12px 0 28px' }}>{sub}</p>
        {children}
      </div>
    </div>
  );
}

function useAuthSubmit(path: string) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (body: object, fallback: (u: User) => string) => {
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const { user } = await api<{ user: User }>(path, { body });
      setUser(user);
      navigate(safeNext(params.get('next')) ?? fallback(user), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return { submit, errors, error, busy, params };
}

export function Login() {
  const { user } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const { submit, errors, error, busy, params } = useAuthSubmit('/auth/login');
  // Only for visitors who were already logged in. During a successful submit `busy` stays true: React Router 7
  // runs navigate() as a transition, so this guard would otherwise win the race and send everyone to "/".
  if (user && !busy) return <Navigate to={safeNext(params.get('next')) ?? '/'} replace />;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(form, (u) => (u.role === 'admin' ? '/admin' : ['owner', 'agent'].includes(u.role) ? '/dashboard' : '/'));
  };
  return (
    <AuthShell title="Welcome back" sub={<>New to BetLink? <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}>Create an account</Link></>}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email}><input className="input" type="email" autoComplete="email" required value={form.email} aria-invalid={!!errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" error={errors.password}><input className="input" type="password" autoComplete="current-password" required value={form.password} aria-invalid={!!errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-block" disabled={busy}>{busy ? <Spinner /> : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}

const ROLES = [
  { value: 'user', title: 'Looking for a home', body: 'Search, save and contact listers' },
  { value: 'owner', title: 'Property owner', body: 'List your own homes or space' },
  { value: 'agent', title: 'Real-estate agent', body: 'Manage listings for clients' },
];

export function Register() {
  const { user } = useAuth();
  const { submit, errors, error, busy, params } = useAuthSubmit('/auth/register');
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
    role: ROLES.some((r) => r.value === params.get('role')) ? params.get('role')! : 'user',
  });
  if (user && !busy) return <Navigate to="/" replace />; // see Login: avoid racing the post-submit navigate()
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(form, (u) => (u.role === 'user' ? '/' : '/dashboard/new'));
  };
  return (
    <AuthShell title="Create your account" sub={<>Already registered? <Link to="/login">Log in</Link></>}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {error && <Alert>{error}</Alert>}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 500, marginBottom: 8 }}>I am</legend>
          <div className="stack" style={{ ['--gap' as string]: '8px' }}>
            {ROLES.map((r) => (
              <label key={r.value} className="panel check" style={{ padding: 14, borderColor: form.role === r.value ? 'var(--ink)' : undefined }}>
                <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm({ ...form, role: r.value })} />
                <span><strong>{r.title}</strong> <span className="muted small">— {r.body}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Full name" error={errors.full_name}><input className="input" autoComplete="name" value={form.full_name} aria-invalid={!!errors.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Email" error={errors.email}><input className="input" type="email" autoComplete="email" value={form.email} aria-invalid={!!errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone (optional)" error={errors.phone} hint="Ethiopian number: 0911 234 567, 0711 234 567 or +251…"><input className="input" type="tel" autoComplete="tel" value={form.phone} aria-invalid={!!errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" value={form.password} aria-invalid={!!errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-block" disabled={busy}>{busy ? <Spinner /> : 'Create account'}</button>
        <p className="tiny muted">Owner and agent accounts start as unverified. You can request verification from your profile; an administrator reviews each request.</p>
      </form>
    </AuthShell>
  );
}
