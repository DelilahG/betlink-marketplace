import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, errorMessage, type Property, type PropertyCard as Card, type PropertyImage } from '../api';
import { useAuth } from '../auth';
import { PropertyCard } from '../components/PropertyCard';
import { Alert, Field, PageLoader, Spinner, StatusBadge } from '../components/ui';
import { ADDIS_SUBCITIES, AMENITIES, label, PROPERTY_TYPES, REGIONS } from '../format';

export type ListingForm = {
  title: string; description: string; listing_type: 'rent' | 'sale'; property_type: string; price_etb: string;
  rent_period: string; deposit_months: string; min_lease_months: string; region: string; city: string; subcity: string;
  neighborhood: string; address_line: string; bedrooms: string; bathrooms: string; area_sqm: string; furnishing: string;
  water_supply: string; electricity: string; parking_spaces: string; amenities: string[]; available_from: string;
  contact_phone: string; contact_whatsapp: boolean;
};

const EMPTY: ListingForm = {
  title: '', description: '', listing_type: 'rent', property_type: 'apartment', price_etb: '', rent_period: 'month',
  deposit_months: '2', min_lease_months: '', region: 'Addis Ababa', city: 'Addis Ababa', subcity: '', neighborhood: '',
  address_line: '', bedrooms: '1', bathrooms: '1', area_sqm: '', furnishing: 'unfurnished', water_supply: 'unknown',
  electricity: 'unknown', parking_spaces: '0', amenities: [], available_from: '', contact_phone: '', contact_whatsapp: false,
};

/** Client-side checks for instant feedback. The API re-validates everything with Zod. */
export function validateListing(f: ListingForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.title.trim().length < 8) e.title = 'Title must be at least 8 characters';
  if (f.description.trim().length < 30) e.description = 'Describe the property in at least 30 characters';
  if (!(Number(f.price_etb) > 0)) e.price_etb = 'Enter a price in birr';
  if (!(Number(f.area_sqm) > 0)) e.area_sqm = 'Enter the area in m²';
  if (f.city.trim().length < 2) e.city = 'Enter a city';
  if (f.contact_phone && !/^(\+?251|0)?[79]\d{8}$|^(\+?251|0)?(11|22|25|33|34|46|47|57|58)\d{7}$/.test(f.contact_phone.replace(/[\s\-().]/g, '')))
    e.contact_phone = 'Enter a valid Ethiopian number, e.g. 0911 234 567';
  return e;
}

function toPayload(f: ListingForm) {
  const num = (v: string) => (v === '' ? null : Number(v));
  const rent = f.listing_type === 'rent';
  return {
    ...f,
    price_etb: Number(f.price_etb), area_sqm: Number(f.area_sqm), bedrooms: Number(f.bedrooms), bathrooms: Number(f.bathrooms),
    parking_spaces: Number(f.parking_spaces), rent_period: rent ? f.rent_period : null,
    deposit_months: rent ? num(f.deposit_months) : null, min_lease_months: rent ? num(f.min_lease_months) : null,
  };
}

const fromProperty = (p: Property): ListingForm => {
  const s = (v: unknown) => (v == null ? '' : String(v));
  return {
    ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s(p[k as keyof Property])])),
    listing_type: p.listing_type, amenities: p.amenities, contact_whatsapp: p.contact_whatsapp,
  } as ListingForm;
};

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export function ListingEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<ListingForm>(EMPTY);
  const [property, setProperty] = useState<Property | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api<{ property: Property }>(`/properties/${id}`)
      .then(({ property: p }) => {
        if (!p.is_owner) throw new Error('You can only edit your own listings.');
        setProperty(p);
        setImages(p.images);
        setForm(fromProperty(p));
        if (window.location.search.includes('created=1'))
          setMsg({ kind: 'success', text: 'Draft saved. Add photos below, then publish when you are ready.' });
      })
      .catch((e) => setMsg({ kind: 'error', text: errorMessage(e) }))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k];
  const inputProps = (k: keyof ListingForm) => ({
    value: form[k] as string,
    'aria-invalid': !!errors[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const v = validateListing(form);
    setErrors(v);
    if (Object.keys(v).length) return setMsg({ kind: 'error', text: 'Please fix the highlighted fields.' });
    setBusy('save');
    setMsg(null);
    try {
      const body = toPayload(form);
      const r = id
        ? await api<{ property: Property }>(`/properties/${id}`, { method: 'PATCH', body })
        : await api<{ property: Property }>('/properties', { body });
      if (!id) return navigate(`/dashboard/${r.property.id}/edit?created=1`, { replace: true });
      setProperty((p) => p && { ...p, ...r.property });
      setMsg({ kind: 'success', text: 'Changes saved.' });
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fields);
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !id) return;
    const list = [...files];
    const bad = list.find((f) => !ACCEPTED.includes(f.type) || f.size > 5 * 1024 * 1024);
    if (bad) return setMsg({ kind: 'error', text: `"${bad.name}" must be a JPEG, PNG or WebP image under 5 MB.` });
    if (images.length + list.length > 12) return setMsg({ kind: 'error', text: 'A listing can have at most 12 photos.' });
    const fd = new FormData();
    list.forEach((f) => fd.append('images', f));
    setBusy('upload');
    setMsg(null);
    try {
      const r = await api<{ images: PropertyImage[] }>(`/properties/${id}/images`, { body: fd });
      setImages((imgs) => [...imgs, ...r.images]);
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeImage = async (img: PropertyImage) => {
    try {
      await api(`/properties/${id}/images/${img.id}`, { method: 'DELETE' });
      setImages((imgs) => imgs.filter((i) => i.id !== img.id));
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    }
  };

  const setStatus = async (status: string) => {
    setBusy(status);
    try {
      await save();
      const r = await api<{ property: Property }>(`/properties/${id}/status`, { body: { status } });
      setProperty((p) => p && { ...p, ...r.property });
      setMsg({ kind: 'success', text: status === 'published' ? 'Your listing is live.' : 'Listing hidden from search.' });
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <PageLoader />;
  const isRent = form.listing_type === 'rent';
  const preview: Card = {
    ...(toPayload(form) as unknown as Card),
    id: id ?? 'preview', title: form.title || 'Your listing title', price_etb: Number(form.price_etb) || 0,
    area_sqm: Number(form.area_sqm) || 0, status: property?.status ?? 'draft', verification_status: property?.verification_status ?? 'unverified',
    is_demo: false, cover_url: images[0]?.url ?? null, owner_name: user!.full_name, owner_role: user!.role,
    owner_verification: user!.verification_status, created_at: '', published_at: null, available_from: null,
    subcity: form.subcity || null, neighborhood: form.neighborhood || null,
  };

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow"><Link to="/dashboard">Dashboard</Link> / {id ? 'Edit listing' : 'New listing'}</p>
        <div className="row" style={{ marginTop: 10 }}>
          <h1 className="h1">{id ? 'Edit listing' : 'Create a listing'}</h1>
          {property && <StatusBadge status={property.status} />}
          {property && property.moderation_status !== 'ok' && <StatusBadge status={property.moderation_status} />}
        </div>
      </header>

      <div className="editor">
        <form onSubmit={save} noValidate>
          {msg && <div style={{ marginBottom: 20 }}><Alert kind={msg.kind}>{msg.text}</Alert></div>}

          <section className="form-section" style={{ borderTop: 0, paddingTop: 0 }}>
            <h2>Basics</h2>
            <div className="stack">
              <div className="seg" role="radiogroup" aria-label="Listing type">
                {(['rent', 'sale'] as const).map((t) => (
                  <button key={t} type="button" role="radio" aria-checked={form.listing_type === t} className={form.listing_type === t ? 'on' : ''} onClick={() => set('listing_type', t)}>
                    {t === 'rent' ? 'For rent' : 'For sale'}
                  </button>
                ))}
              </div>
              <Field label="Title" error={err('title')}><input className="input" maxLength={120} placeholder="e.g. Bright two-bedroom apartment near Bole Atlas" {...inputProps('title')} /></Field>
              <Field label="Description" error={err('description')} hint="Mention the condition, nearby landmarks, transport and anything a visitor should know.">
                <textarea className="textarea" maxLength={5000} rows={6} {...inputProps('description')} />
              </Field>
              <div className="grid-2">
                <Field label="Property type"><select className="select" {...inputProps('property_type')}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
                <Field label="Furnishing"><select className="select" {...inputProps('furnishing')}>{['furnished', 'semi_furnished', 'unfurnished'].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></Field>
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>Price</h2>
            <div className="grid-2">
              <Field label={isRent ? 'Rent (ETB)' : 'Sale price (ETB)'} error={err('price_etb')}><input className="input" inputMode="decimal" {...inputProps('price_etb')} /></Field>
              {isRent && (
                <Field label="Per" error={err('rent_period')}><select className="select" {...inputProps('rent_period')}><option value="month">Month</option><option value="year">Year</option></select></Field>
              )}
              {isRent && <Field label="Deposit (months)" error={err('deposit_months')}><input className="input" type="number" min={0} max={24} {...inputProps('deposit_months')} /></Field>}
              {isRent && <Field label="Minimum lease (months)" error={err('min_lease_months')} hint="Leave empty if flexible"><input className="input" type="number" min={1} max={120} {...inputProps('min_lease_months')} /></Field>}
              <Field label="Available from" error={err('available_from')} hint="Leave empty if available now"><input className="input" type="date" {...inputProps('available_from')} /></Field>
            </div>
          </section>

          <section className="form-section">
            <h2>Location</h2>
            <div className="grid-2">
              <Field label="Region" error={err('region')}><select className="select" {...inputProps('region')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
              <Field label="City / town" error={err('city')}><input className="input" {...inputProps('city')} /></Field>
              <Field label="Subcity" error={err('subcity')} hint={form.region === 'Addis Ababa' ? undefined : 'Optional outside Addis Ababa'}>
                {form.region === 'Addis Ababa' ? (
                  <select className="select" {...inputProps('subcity')}><option value="">Choose subcity</option>{ADDIS_SUBCITIES.map((s) => <option key={s}>{s}</option>)}</select>
                ) : (
                  <input className="input" {...inputProps('subcity')} />
                )}
              </Field>
              <Field label="Neighbourhood" error={err('neighborhood')}><input className="input" placeholder="e.g. Atlas, CMC, Sarbet" {...inputProps('neighborhood')} /></Field>
            </div>
            <div style={{ marginTop: 16 }}>
              <Field label="Address details (optional)" hint="Shown publicly. Leave out a house number if you prefer to share it after contact.">
                <input className="input" maxLength={200} {...inputProps('address_line')} />
              </Field>
            </div>
          </section>

          <section className="form-section">
            <h2>Size & services</h2>
            <div className="grid-3">
              <Field label="Bedrooms" error={err('bedrooms')}><input className="input" type="number" min={0} max={50} {...inputProps('bedrooms')} /></Field>
              <Field label="Bathrooms" error={err('bathrooms')}><input className="input" type="number" min={0} max={50} {...inputProps('bathrooms')} /></Field>
              <Field label="Area (m²)" error={err('area_sqm')}><input className="input" inputMode="decimal" {...inputProps('area_sqm')} /></Field>
              <Field label="Parking spaces"><input className="input" type="number" min={0} max={100} {...inputProps('parking_spaces')} /></Field>
              <Field label="Water"><select className="select" {...inputProps('water_supply')}>{['continuous', 'scheduled', 'tank_backup', 'unknown'].map((v) => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
              <Field label="Electricity"><select className="select" {...inputProps('electricity')}>{['stable', 'generator_backup', 'intermittent', 'unknown'].map((v) => <option key={v} value={v}>{label(v)}</option>)}</select></Field>
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: '20px 0 0' }}>
              <legend className="small" style={{ fontWeight: 500, marginBottom: 10 }}>Amenities</legend>
              <div className="chips">
                {AMENITIES.map((a) => (
                  <button key={a} type="button" className="chip" aria-pressed={form.amenities.includes(a)}
                    onClick={() => set('amenities', form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a])}>
                    {label(a)}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <section className="form-section">
            <h2>Contact</h2>
            <div className="grid-2">
              <Field label="Public contact phone (optional)" error={err('contact_phone')} hint="Shown on the listing with a call button. Leave empty to receive inquiries only.">
                <input className="input" type="tel" placeholder="0911 234 567" {...inputProps('contact_phone')} />
              </Field>
              <label className="check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={form.contact_whatsapp} onChange={(e) => set('contact_whatsapp', e.target.checked)} /> This number uses WhatsApp
              </label>
            </div>
          </section>

          <section className="form-section">
            <h2>Photos</h2>
            {!id ? (
              <p className="muted small">Save the listing as a draft first, then add up to 12 photos.</p>
            ) : (
              <>
                <div className="uploads">
                  {images.map((img, i) => (
                    <figure key={img.id}>
                      <img src={img.url} alt={`Photo ${i + 1}`} />
                      {i === 0 && <span className="badge badge-dark" style={{ position: 'absolute', left: 6, bottom: 6 }}>Cover</span>}
                      <button type="button" className="icon-btn" aria-label={`Remove photo ${i + 1}`} onClick={() => removeImage(img)}><Trash2 size={14} /></button>
                    </figure>
                  ))}
                  {images.length < 12 && (
                    <label className="dropzone">
                      {busy === 'upload' ? <Spinner /> : <span><ImagePlus size={22} aria-hidden /><br />Add photos<br /><span className="tiny">JPEG, PNG, WebP · 5 MB max</span></span>}
                      <input ref={fileRef} type="file" accept={ACCEPTED.join(',')} multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy === 'upload'} />
                    </label>
                  )}
                </div>
                <p className="tiny muted" style={{ marginTop: 10 }}>Only upload photos you took or have the right to use. The first photo is the cover.</p>
              </>
            )}
          </section>

          <div className="row form-section">
            <button className="btn btn-ghost" disabled={!!busy}>{busy === 'save' ? <Spinner /> : id ? 'Save changes' : 'Save draft'}</button>
            {id && property?.status !== 'published' && property?.moderation_status !== 'removed' && (
              <button type="button" className="btn btn-accent" disabled={!!busy || !images.length} onClick={() => setStatus('published')}>
                {busy === 'published' ? <Spinner /> : 'Publish listing'}
              </button>
            )}
            {id && property?.status === 'published' && (
              <button type="button" className="btn btn-ghost" disabled={!!busy} onClick={() => setStatus('unpublished')}>Unpublish</button>
            )}
            {id && !images.length && <span className="small muted">Add at least one photo to publish.</span>}
          </div>
        </form>

        <aside>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Preview</p>
          <PropertyCard p={preview} />
          <p className="tiny muted" style={{ marginTop: 14 }}>This is how your listing appears in search results.</p>
        </aside>
      </div>
    </div>
  );
}
