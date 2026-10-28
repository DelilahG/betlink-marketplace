import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../api';
import { Alert, PageLoader, StatusBadge } from '../components/ui';
import { formatDate, label, priceLabel } from '../format';
import { useApi } from '../hooks';

interface Stats { users: number; published: number; flagged: number; open_reports: number; pending_verifications: number }
interface AdminListing { id: string; title: string; listing_type: string; city: string; subcity: string | null; price_etb: number; rent_period: string | null; status: string; moderation_status: string; verification_status: string; is_demo: boolean; created_at: string; owner_name: string; owner_email: string; open_reports: number }
interface AdminReport { id: string; reason: string; details: string | null; status: string; created_at: string; property_id: string; property_title: string; moderation_status: string; reporter_name: string }
interface AdminUser { id: string; email: string; full_name: string; phone: string | null; role: string; verification_status: string; is_suspended: boolean; created_at: string; listing_count: number }

/** Runs an admin mutation then reloads the table; surfaces API errors. */
function useAction(reload: () => void) {
  const [error, setError] = useState('');
  const run = async (path: string, body: object) => {
    setError('');
    try {
      await api(path, { method: 'PATCH', body });
      reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  return { run, error };
}

function Listings() {
  const [moderation, setModeration] = useState('');
  const [q, setQ] = useState('');
  const qs = new URLSearchParams({ ...(moderation && { moderation }), ...(q && { q }) });
  const { data, loading, error, reload } = useApi<{ items: AdminListing[] }>(`/admin/properties?${qs}`);
  const { run, error: actionError } = useAction(reload);
  const patch = (id: string, body: object) => run(`/admin/properties/${id}`, body);
  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="Search title or owner email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search listings" />
        <select className="select" style={{ width: 'auto' }} value={moderation} onChange={(e) => setModeration(e.target.value)} aria-label="Moderation filter">
          <option value="">All moderation states</option><option value="flagged">Flagged</option><option value="ok">OK</option><option value="removed">Removed</option>
        </select>
      </div>
      {(error || actionError) && <Alert>{error || actionError}</Alert>}
      {loading && !data ? <PageLoader /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Listing</th><th>Owner</th><th>Status</th><th>Reports</th><th>Actions</th></tr></thead>
            <tbody>
              {data?.items.map((p) => {
                const price = priceLabel(p, true);
                return (
                  <tr key={p.id}>
                    <td><Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link><div className="tiny muted">{price.amount} {price.suffix} · {p.subcity ?? p.city} {p.is_demo && '· demo'}</div></td>
                    <td>{p.owner_name}<div className="tiny muted">{p.owner_email}</div></td>
                    <td><div className="row" style={{ gap: 4 }}><StatusBadge status={p.status} /><StatusBadge status={p.moderation_status} />{p.verification_status === 'verified' && <StatusBadge status="verified" />}</div></td>
                    <td>{p.open_reports}</td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        {p.moderation_status !== 'ok' && <button className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { moderation_status: 'ok' })}>Restore</button>}
                        {p.moderation_status !== 'removed' && <button className="btn btn-danger btn-sm" onClick={() => patch(p.id, { moderation_status: 'removed' })}>Remove</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { verification_status: p.verification_status === 'verified' ? 'unverified' : 'verified' })}>
                          {p.verification_status === 'verified' ? 'Unverify' : 'Mark verified'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && !data.items.length && <p className="muted" style={{ padding: 16 }}>No listings match.</p>}
        </div>
      )}
    </>
  );
}

function Reports() {
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useApi<{ items: AdminReport[] }>(`/admin/reports?status=${status}`);
  const { run, error: actionError } = useAction(reload);
  return (
    <>
      <div className="seg" style={{ marginBottom: 16 }}>
        {['open', 'resolved', 'dismissed'].map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{label(s)}</button>)}
      </div>
      {(error || actionError) && <Alert>{error || actionError}</Alert>}
      {loading && !data ? <PageLoader /> : !data?.items.length ? <p className="muted">No {status} reports.</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Listing</th><th>Reason</th><th>Reporter</th><th>Date</th>{status === 'open' && <th>Actions</th>}</tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/properties/${r.property_id}`}>{r.property_title}</Link> <StatusBadge status={r.moderation_status} /></td>
                  <td><strong>{label(r.reason)}</strong>{r.details && <div className="small muted">{r.details}</div>}</td>
                  <td>{r.reporter_name}</td>
                  <td className="small">{formatDate(r.created_at)}</td>
                  {status === 'open' && (
                    <td><div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => run(`/admin/reports/${r.id}`, { status: 'dismissed' })}>Dismiss</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => run(`/admin/reports/${r.id}`, { status: 'resolved' })}>Resolve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => run(`/admin/reports/${r.id}`, { status: 'resolved', remove_listing: true })}>Resolve & remove listing</button>
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Users() {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<{ items: AdminUser[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const { run, error: actionError } = useAction(reload);
  const patch = (id: string, body: object) => run(`/admin/users/${id}`, body);
  return (
    <>
      <input className="input" style={{ maxWidth: 320, marginBottom: 16 }} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
      {(error || actionError) && <Alert>{error || actionError}</Alert>}
      {loading && !data ? <PageLoader /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>Listings</th><th>Verification</th><th>Actions</th></tr></thead>
            <tbody>
              {data?.items.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.full_name}</strong><div className="tiny muted">{u.email} · joined {formatDate(u.created_at)}</div></td>
                  <td>{label(u.role)}{u.is_suspended && <> <span className="badge badge-red">Suspended</span></>}</td>
                  <td>{u.listing_count}</td>
                  <td><StatusBadge status={u.verification_status} /></td>
                  <td><div className="row" style={{ gap: 4 }}>
                    {u.verification_status !== 'verified' && <button className="btn btn-ghost btn-sm" onClick={() => patch(u.id, { verification_status: 'verified' })}>Verify</button>}
                    {u.verification_status === 'pending' && <button className="btn btn-ghost btn-sm" onClick={() => patch(u.id, { verification_status: 'rejected' })}>Reject</button>}
                    {u.verification_status === 'verified' && <button className="btn btn-ghost btn-sm" onClick={() => patch(u.id, { verification_status: 'unverified' })}>Revoke</button>}
                    {u.role !== 'admin' && <button className="btn btn-danger btn-sm" onClick={() => patch(u.id, { is_suspended: !u.is_suspended })}>{u.is_suspended ? 'Unsuspend' : 'Suspend'}</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const TABS = { listings: 'Listings', reports: 'Reports', users: 'Users' } as const;
export function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') ?? 'listings') as keyof typeof TABS;
  const stats = useApi<Stats>('/admin/stats');
  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">Administration</p>
        <h1 className="h1" style={{ marginTop: 10 }}>Moderation</h1>
      </header>
      {stats.data && (
        <div className="stat-row">
          <div className="stat"><span className="muted small">Published listings</span><strong>{stats.data.published}</strong></div>
          <div className="stat"><span className="muted small">Flagged listings</span><strong>{stats.data.flagged}</strong></div>
          <div className="stat"><span className="muted small">Open reports</span><strong>{stats.data.open_reports}</strong></div>
          <div className="stat"><span className="muted small">Pending verifications</span><strong>{stats.data.pending_verifications}</strong></div>
          <div className="stat"><span className="muted small">Users</span><strong>{stats.data.users}</strong></div>
        </div>
      )}
      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}>{TABS[k]}</button>
        ))}
      </div>
      {tab === 'listings' && <Listings />}
      {tab === 'reports' && <Reports />}
      {tab === 'users' && <Users />}
    </div>
  );
}
