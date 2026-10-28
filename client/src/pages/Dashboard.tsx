import { useState } from 'react';
import { Building2, Eye, Heart, Inbox, MessageSquare, Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage, type MyListing } from '../api';
import { Alert, EmptyState, PageLoader, StatusBadge } from '../components/ui';
import { formatDate, formatPhone, priceLabel, timeAgo } from '../format';
import { useApi } from '../hooks';

function Listings() {
  const { data, loading, error, reload } = useApi<{ items: MyListing[] }>('/properties/mine');
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'success', text: success });
      reload();
    } catch (err) {
      setMsg({ kind: 'error', text: errorMessage(err) });
    }
  };
  const setStatus = (p: MyListing, status: string, text: string) =>
    act(() => api(`/properties/${p.id}/status`, { body: { status } }), text);

  if (loading && !data) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  const items = data!.items;
  const sum = (k: 'view_count' | 'inquiry_count' | 'favorite_count') => items.reduce((n, p) => n + Number(p[k]), 0);

  return (
    <>
      <div className="stat-row">
        <div className="stat"><span className="muted small"><Building2 size={14} /> Published</span><strong>{items.filter((p) => p.status === 'published').length}</strong></div>
        <div className="stat"><span className="muted small"><Eye size={14} /> Total views</span><strong>{sum('view_count')}</strong></div>
        <div className="stat"><span className="muted small"><MessageSquare size={14} /> Inquiries</span><strong>{sum('inquiry_count')}</strong></div>
        <div className="stat"><span className="muted small"><Heart size={14} /> Saves</span><strong>{sum('favorite_count')}</strong></div>
      </div>
      {msg && <div style={{ marginBottom: 16 }}><Alert kind={msg.kind}>{msg.text}</Alert></div>}
      {!items.length ? (
        <EmptyState icon={Building2} title="You have no listings yet">
          <p>Create a draft, add photos and publish when you are ready.</p>
          <Link className="btn" to="/dashboard/new"><Plus size={16} /> Create listing</Link>
        </EmptyState>
      ) : (
        items.map((p) => {
          const price = priceLabel(p, true);
          return (
            <div key={p.id} className="list-row">
              {p.cover_url ? <img src={p.cover_url} alt="" /> : <div className="thumb" />}
              <div className="stack" style={{ ['--gap' as string]: '6px' }}>
                <div className="row" style={{ gap: 6 }}>
                  <StatusBadge status={p.status} />
                  {p.moderation_status !== 'ok' && <StatusBadge status={p.moderation_status} />}
                  {p.is_demo && <span className="badge badge-line">Demo</span>}
                </div>
                <Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link>
                <span className="small muted">
                  {price.amount}{price.suffix && ` ${price.suffix}`} · {p.view_count} views · {p.inquiry_count} inquiries
                  {Number(p.new_inquiry_count) > 0 && <strong style={{ color: 'var(--accent)' }}> ({p.new_inquiry_count} new)</strong>} · updated {timeAgo(p.updated_at)}
                </span>
              </div>
              <div className="actions">
                <Link className="btn btn-ghost btn-sm" to={`/dashboard/${p.id}/edit`}>Edit</Link>
                {p.status !== 'published' && p.moderation_status !== 'removed' && (
                  <button className="btn btn-sm" onClick={() => setStatus(p, 'published', 'Listing published.')}>Publish</button>
                )}
                {p.status === 'published' && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'unpublished', 'Listing hidden from search.')}>Unpublish</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setStatus(p, p.listing_type === 'rent' ? 'rented' : 'sold', 'Status updated.')}>
                      Mark {p.listing_type === 'rent' ? 'rented' : 'sold'}
                    </button>
                  </>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => confirm(`Delete "${p.title}" permanently? This also removes its photos and inquiries.`) && act(() => api(`/properties/${p.id}`, { method: 'DELETE' }), 'Listing deleted.')}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

interface ReceivedInquiry { id: string; name: string; email: string; phone: string | null; message: string; status: string; created_at: string; property_id: string; property_title: string }
function Received() {
  const { data, setData, loading, error } = useApi<{ items: ReceivedInquiry[] }>('/me/inquiries/received');
  const [err, setErr] = useState('');
  const setStatus = async (q: ReceivedInquiry, status: string) => {
    try {
      await api(`/me/inquiries/${q.id}`, { method: 'PATCH', body: { status } });
      setData((d) => d && { items: d.items.map((x) => (x.id === q.id ? { ...x, status } : x)) });
    } catch (e) {
      setErr(errorMessage(e));
    }
  };
  if (loading) return <PageLoader />;
  if (error) return <Alert>{error}</Alert>;
  if (!data?.items.length) return <EmptyState icon={Inbox} title="No inquiries yet">When someone asks about one of your listings, it appears here.</EmptyState>;
  return (
    <div>
      {err && <Alert>{err}</Alert>}
      {data.items.map((q) => (
        <article key={q.id} className="inquiry">
          <div className="row">
            <strong>{q.name}</strong>
            <StatusBadge status={q.status} />
            <span className="spacer" />
            <span className="tiny muted">{formatDate(q.created_at)}</span>
          </div>
          <div className="small muted">about <Link to={`/properties/${q.property_id}`}>{q.property_title}</Link></div>
          <p>{q.message}</p>
          <div className="row small">
            <a href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: ${q.property_title}`)}`}>{q.email}</a>
            {q.phone && <a href={`tel:${q.phone}`}>{formatPhone(q.phone)}</a>}
            <span className="spacer" />
            <select className="select" style={{ height: 36, width: 'auto' }} aria-label="Inquiry status" value={q.status} onChange={(e) => setStatus(q, e.target.value)}>
              <option value="new">New</option>
              <option value="responded">Responded</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'inquiries' ? 'inquiries' : 'listings';
  return (
    <div className="container">
      <header className="page-head row" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="h1" style={{ marginTop: 10 }}>Your listings</h1>
        </div>
        <span className="spacer" />
        <Link to="/dashboard/new" className="btn btn-accent"><Plus size={16} aria-hidden /> New listing</Link>
      </header>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'listings'} onClick={() => setParams({})}>Listings</button>
        <button role="tab" aria-selected={tab === 'inquiries'} onClick={() => setParams({ tab: 'inquiries' })}>Inquiries received</button>
      </div>
      {tab === 'listings' ? <Listings /> : <Received />}
    </div>
  );
}
