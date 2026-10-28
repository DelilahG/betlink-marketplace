import { useState, type FormEvent } from 'react';
import { Heart, Inbox } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError, errorMessage, type PropertyCard as Card, type User } from '../api';
import { useAuth } from '../auth';
import { PropertyCard } from '../components/PropertyCard';
import { Alert, CardSkeleton, EmptyState, Field, PageLoader, Spinner, StatusBadge, VerificationBadge } from '../components/ui';
import { formatDate, label } from '../format';
import { useApi, useFavoriteToggle } from '../hooks';

function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ full_name: user!.full_name, phone: user!.phone ?? '', role: user!.role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (body: object, success: string) => {
    setBusy(true);
    setErrors({});
    setMsg(null);
    try {
      const r = await api<{ user: User }>('/auth/me', { method: 'PATCH', body });
      setUser(r.user);
      setMsg({ kind: 'success', text: success });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMsg({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save(user!.role === 'admin' ? { full_name: form.full_name, phone: form.phone } : form, 'Profile saved.');
  };

  return (
    <div className="grid-2" style={{ gap: 40, alignItems: 'start' }}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <Field label="Email" hint="Email cannot be changed"><input className="input" value={user!.email} disabled /></Field>
        <Field label="Full name" error={errors.full_name}><input className="input" value={form.full_name} aria-invalid={!!errors.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Phone" error={errors.phone} hint="Kept private. Add a contact number on each listing if you want it shown."><input className="input" type="tel" value={form.phone} aria-invalid={!!errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {user!.role !== 'admin' && (
          <Field label="Account type" hint="Owners and agents can create listings.">
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}>
              <option value="user">Looking for a home</option>
              <option value="owner">Property owner</option>
              <option value="agent">Real-estate agent</option>
            </select>
          </Field>
        )}
        <button className="btn" disabled={busy}>{busy ? <Spinner /> : 'Save changes'}</button>
      </form>
      <div className="panel stack">
        <h2 className="h3">Verification</h2>
        <VerificationBadge status={user!.verification_status} kind="person" />
        <p className="small muted">
          {user!.verification_status === 'pending'
            ? 'Your request is waiting for an administrator to review it.'
            : user!.verification_status === 'verified'
              ? 'An administrator has verified your identity details.'
              : 'Verified badges are only given after an administrator reviews your account. In a production deployment this would include checking ID or a business licence.'}
        </p>
        {['unverified', 'rejected'].includes(user!.verification_status) && (
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save({ request_verification: true }, 'Verification requested.')}>Request verification</button>
        )}
        <p className="tiny muted">Member since {formatDate(user!.created_at)} · {label(user!.role)}</p>
      </div>
    </div>
  );
}

function Saved() {
  const { data, setData, loading, error } = useApi<{ items: Card[] }>('/me/favorites');
  const toggle = useFavoriteToggle((id, fav) => setData((d) => d && { items: fav ? d.items : d.items.filter((p) => p.id !== id) }));
  if (error) return <Alert>{error}</Alert>;
  if (data && !data.items.length)
    return <EmptyState icon={Heart} title="No saved homes yet">Tap the heart on any listing to keep it here. <p><Link className="btn btn-ghost" to="/rent">Browse rentals</Link></p></EmptyState>;
  return <div className="cards">{loading ? <CardSkeleton /> : data?.items.map((p) => <PropertyCard key={p.id} p={p} onToggleFavorite={toggle} />)}</div>;
}

interface SentInquiry { id: string; message: string; status: string; created_at: string; property_id: string; property_title: string; city: string; subcity: string | null }
function Inquiries() {
  const { data, loading, error } = useApi<{ items: SentInquiry[] }>('/me/inquiries/sent');
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  if (!data?.items.length) return <EmptyState icon={Inbox} title="No inquiries yet">Inquiries you send while logged in appear here.</EmptyState>;
  return (
    <div>
      {data.items.map((q) => (
        <article key={q.id} className="inquiry">
          <div className="row"><Link to={`/properties/${q.property_id}`}><strong>{q.property_title}</strong></Link><StatusBadge status={q.status} /><span className="spacer" /><span className="tiny muted">{formatDate(q.created_at)}</span></div>
          <p className="muted small">{q.message}</p>
        </article>
      ))}
    </div>
  );
}

const TABS = { profile: 'Profile', saved: 'Saved homes', inquiries: 'My inquiries' } as const;
export function Account() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as keyof typeof TABS) in TABS ? (params.get('tab') as keyof typeof TABS) : 'profile';
  const { user } = useAuth();
  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">Account</p>
        <h1 className="h1" style={{ marginTop: 10 }}>Selam, {user!.full_name.split(' ')[0]}</h1>
      </header>
      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}>{TABS[k]}</button>
        ))}
      </div>
      {tab === 'profile' && <Profile />}
      {tab === 'saved' && <Saved />}
      {tab === 'inquiries' && <Inquiries />}
    </div>
  );
}
