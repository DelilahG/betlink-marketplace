import { useEffect, useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Flag, Heart, MapPin, MessageCircle, Phone, Share2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage, type Property } from '../api';
import { useAuth } from '../auth';
import { locationLine } from '../components/PropertyCard';
import { Alert, Field, PageLoader, Spinner, StatusBadge, VerificationBadge } from '../components/ui';
import { formatArea, formatBirr, formatDate, formatPhone, isMobile, label, priceLabel, telLink, timeAgo, whatsappLink } from '../format';
import { useApi, useFavoriteToggle } from '../hooks';
import { NotFound } from './NotFound';

function Gallery({ images, title }: { images: Property['images']; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => ((i ?? 0) + 1) % images.length);
      if (e.key === 'ArrowLeft') setOpen((i) => ((i ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, images.length]);
  if (!images.length) return <div className="gallery single skeleton" aria-label="No photos yet" />;
  return (
    <>
      <div className={`gallery ${images.length === 1 ? 'single' : ''}`}>
        {images.slice(0, 3).map((img, i) => (
          <button key={img.id} onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${images.length}`}>
            <img src={img.url} alt={i === 0 ? title : ''} />
            {i === 2 && images.length > 3 && <span className="badge badge-dark more">+{images.length - 3} photos</span>}
          </button>
        ))}
      </div>
      {images[0]?.credit && <p className="tiny muted" style={{ marginTop: 8 }}>{images[0].credit}</p>}
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}>
          <img src={images[open].url} alt={`${title} — photo ${open + 1}`} onClick={(e) => e.stopPropagation()} />
          <button className="icon-btn" style={{ top: 20, right: 20 }} aria-label="Close" onClick={() => setOpen(null)} autoFocus><X size={18} /></button>
          {images.length > 1 && (
            <>
              <button className="icon-btn" style={{ left: 20, top: '50%' }} aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + images.length) % images.length); }}><ChevronLeft size={18} /></button>
              <button className="icon-btn" style={{ right: 20, top: '50%' }} aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % images.length); }}><ChevronRight size={18} /></button>
            </>
          )}
        </div>
      )}
    </>
  );
}

function InquiryForm({ p }: { p: Property }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.full_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    message: `Hello, I am interested in "${p.title}". Is it still available, and when could I arrange a viewing?`,
    website: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    setErrors({});
    setError('');
    try {
      await api(`/properties/${p.id}/inquiries`, { body: form });
      setState('sent');
    } catch (err) {
      setState('idle');
      if (err instanceof ApiError) setErrors(err.fields);
      setError(errorMessage(err));
    }
  };

  if (state === 'sent')
    return (
      <Alert kind="success">
        <strong>Inquiry sent.</strong> The {label(p.owner_role).toLowerCase()} will reply by email{form.phone ? ' or phone' : ''}.
        {user && <> You can track it under <Link to="/account?tab=inquiries">My inquiries</Link>.</>}
      </Alert>
    );

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {error && <Alert>{error}</Alert>}
      <Field label="Your name" error={errors.name}><input className="input" required value={form.name} aria-invalid={!!errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></Field>
      <Field label="Email" error={errors.email}><input className="input" type="email" required value={form.email} aria-invalid={!!errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>
      <Field label="Phone (optional)" error={errors.phone} hint="Ethiopian number, e.g. 0911 234 567"><input className="input" type="tel" value={form.phone} aria-invalid={!!errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></Field>
      <Field label="Message" error={errors.message}><textarea className="textarea" required value={form.message} aria-invalid={!!errors.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
      {/* Honeypot: hidden from people and assistive tech, bots tend to fill it */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: 'absolute', left: '-9999px' }} />
      <button className="btn btn-accent btn-block" disabled={state === 'sending'}>{state === 'sending' ? <Spinner /> : 'Send inquiry'}</button>
      <p className="tiny muted">Your details are shared only with this lister. BetLink never asks for payment.</p>
    </form>
  );
}

function ReportForm({ id }: { id: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('scam');
  const [details, setDetails] = useState('');
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  if (!user) return <Link to={`/login?next=/properties/${id}`} className="link small"><Flag size={14} aria-hidden /> Log in to report this listing</Link>;
  if (msg?.kind === 'success') return <Alert kind="success">{msg.text}</Alert>;
  if (!open) return <button className="link small" onClick={() => setOpen(true)}><Flag size={14} aria-hidden /> Report this listing</button>;
  return (
    <form
      className="stack panel"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api(`/properties/${id}/reports`, { body: { reason, details } });
          setMsg({ kind: 'success', text: 'Thank you. A moderator will review this listing.' });
        } catch (err) {
          setMsg({ kind: 'error', text: errorMessage(err) });
        }
      }}
    >
      {msg && <Alert>{msg.text}</Alert>}
      <Field label="What is wrong?">
        <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
          {['scam', 'inaccurate', 'duplicate', 'unavailable', 'offensive', 'other'].map((r) => <option key={r} value={r}>{label(r)}</option>)}
        </select>
      </Field>
      <Field label="Details (optional)"><textarea className="textarea" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <div className="row"><button className="btn btn-sm">Submit report</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

export function PropertyDetail() {
  const { id } = useParams();
  const { data, setData, loading, error } = useApi<{ property: Property }>(`/properties/${id}`);
  const toggle = useFavoriteToggle((_, fav) => setData((d) => d && { property: { ...d.property, is_favorite: fav } }));
  const [copied, setCopied] = useState(false);

  if (loading) return <PageLoader />;
  if (error || !data) return <NotFound title="This listing is not available" body={error ?? undefined} />;
  const p = data.property;
  const price = priceLabel(p);
  const isRent = p.listing_type === 'rent';

  const spec: [string, string][] = [
    ['Property type', label(p.property_type)],
    ['Listing', label(p.listing_type)],
    ['Furnishing', label(p.furnishing)],
    ['Water', label(p.water_supply)],
    ['Electricity', label(p.electricity)],
    ['Parking', p.parking_spaces ? `${p.parking_spaces} space${p.parking_spaces > 1 ? 's' : ''}` : 'None'],
    ['Available', p.available_from && new Date(p.available_from) > new Date() ? formatDate(p.available_from) : 'Now'],
    ...(isRent
      ? ([
          ['Deposit', p.deposit_months != null ? `${p.deposit_months} month${p.deposit_months === 1 ? '' : 's'} (${formatBirr(p.price_etb * p.deposit_months)})` : 'Ask lister'],
          ['Minimum lease', p.min_lease_months ? `${p.min_lease_months} months` : 'Flexible'],
        ] as [string, string][])
      : []),
    ['Listed', p.published_at ? timeAgo(p.published_at) : 'Not published'],
  ];

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      {p.is_owner && (
        <div style={{ marginBottom: 20 }}>
          <Alert kind="info">
            You are viewing your own listing · status <StatusBadge status={p.status} />
            {p.moderation_status !== 'ok' && <> · moderation <StatusBadge status={p.moderation_status} /></>} ·{' '}
            <Link to={`/dashboard/${p.id}/edit`}>Edit listing</Link>
          </Alert>
        </div>
      )}
      <nav className="small muted" aria-label="Breadcrumb" style={{ marginBottom: 16 }}>
        <Link to={isRent ? '/rent' : '/buy'}>{isRent ? 'Rent' : 'Buy'}</Link> / <Link to={`${isRent ? '/rent' : '/buy'}?q=${encodeURIComponent(p.subcity ?? p.city)}`}>{p.subcity ?? p.city}</Link>
      </nav>

      <Gallery images={p.images} title={p.title} />

      <div className="detail">
        <div className="stack" style={{ ['--gap' as string]: '40px' }}>
          <div>
            <div className="row" style={{ marginBottom: 14 }}>
              <span className="badge badge-dark">{label(p.listing_type)}</span>
              <VerificationBadge status={p.verification_status} />
              {p.is_demo && <span className="badge badge-amber">Demo listing — fictional, for demonstration</span>}
              {(p.status === 'rented' || p.status === 'sold') && <StatusBadge status={p.status} />}
            </div>
            <h1 className="h1">{p.title}</h1>
            <p className="loc" style={{ marginTop: 12, fontSize: 16 }}><MapPin size={17} aria-hidden /> {locationLine(p)}{p.region !== p.city ? `, ${p.region}` : ''}</p>
          </div>

          <div className="keyfacts">
            {p.bedrooms > 0 && <div><strong>{p.bedrooms}</strong><span className="muted small">Bedrooms</span></div>}
            {p.bathrooms > 0 && <div><strong>{p.bathrooms}</strong><span className="muted small">Bathrooms</span></div>}
            <div><strong>{formatArea(p.area_sqm)}</strong><span className="muted small">Area</span></div>
            <div><strong>{p.parking_spaces}</strong><span className="muted small">Parking</span></div>
          </div>

          <section aria-labelledby="about-h">
            <h2 id="about-h" className="h3" style={{ marginBottom: 14 }}>About this property</h2>
            <p className="description">{p.description}</p>
          </section>

          <section aria-labelledby="spec-h">
            <h2 id="spec-h" className="h3" style={{ marginBottom: 8 }}>Details</h2>
            <dl className="spec">{spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>

          {p.amenities.length > 0 && (
            <section aria-labelledby="am-h">
              <h2 id="am-h" className="h3" style={{ marginBottom: 16 }}>Amenities</h2>
              <ul className="amenities">{p.amenities.map((a) => <li key={a}><Check size={16} color="var(--green)" aria-hidden /> {label(a)}</li>)}</ul>
            </section>
          )}

          <section aria-labelledby="loc-h">
            <h2 id="loc-h" className="h3" style={{ marginBottom: 8 }}>Location</h2>
            <dl className="spec">
              <div><dt>Region</dt><dd>{p.region}</dd></div>
              <div><dt>City</dt><dd>{p.city}</dd></div>
              {p.subcity && <div><dt>Subcity</dt><dd>{p.subcity}</dd></div>}
              {p.neighborhood && <div><dt>Neighbourhood</dt><dd>{p.neighborhood}</dd></div>}
              {p.address_line && <div><dt>Address</dt><dd>{p.address_line}</dd></div>}
            </dl>
            <p className="small muted" style={{ marginTop: 12 }}>Locations are provided by the lister and have not been independently verified. Confirm the exact address before visiting.</p>
          </section>

          <ReportForm id={p.id} />
        </div>

        <aside className="stack">
          <div className="panel stack">
            <div className="card-price" style={{ fontSize: 40 }}>{price.amount}{price.suffix && <small>{price.suffix}</small>}</div>
            <div className="row">
              <button className="btn btn-ghost btn-sm" aria-pressed={!!p.is_favorite} onClick={() => toggle(p)}>
                <Heart size={16} fill={p.is_favorite ? 'var(--accent)' : 'none'} color={p.is_favorite ? 'var(--accent)' : 'currentColor'} aria-hidden /> {p.is_favorite ? 'Saved' : 'Save'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard?.writeText(location.href); setCopied(true); }}>
                <Share2 size={16} aria-hidden /> {copied ? 'Link copied' : 'Share'}
              </button>
            </div>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
            <div className="row">
              <div className="avatar" aria-hidden>{p.owner_name.charAt(0)}</div>
              <div>
                <strong>{p.owner_name}</strong>
                <div className="tiny muted">{label(p.owner_role)} · on BetLink since {new Date(p.owner_since).getFullYear()}</div>
              </div>
            </div>
            <VerificationBadge status={p.owner_verification} kind="person" />
            {p.contact_phone && p.status === 'published' ? (
              <div className="grid-2" style={{ gap: 8 }}>
                <a className="btn btn-ghost btn-sm" href={telLink(p.contact_phone)}><Phone size={16} aria-hidden /> {formatPhone(p.contact_phone)}</a>
                {p.contact_whatsapp && isMobile(p.contact_phone) && (
                  <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={whatsappLink(p.contact_phone, `Hello, I saw "${p.title}" on BetLink.`)}>
                    <MessageCircle size={16} aria-hidden /> WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="tiny muted">The lister has not shared a phone number. Send an inquiry below.</p>
            )}
          </div>
          {!p.is_owner && p.status === 'published' && (
            <div className="panel">
              <h2 className="h3" style={{ marginBottom: 16 }}>Ask about this property</h2>
              <InquiryForm p={p} />
            </div>
          )}
          {p.status !== 'published' && !p.is_owner && <Alert kind="info">This property is no longer available.</Alert>}
        </aside>
      </div>
    </div>
  );
}
