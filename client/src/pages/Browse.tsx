import { useEffect, useState, type FormEvent } from 'react';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Paged, PropertyCard as Card } from '../api';
import { PropertyCard } from '../components/PropertyCard';
import { CardSkeleton, EmptyState, Field } from '../components/ui';
import { label, PROPERTY_TYPES, REGIONS } from '../format';
import { useApi, useFavoriteToggle } from '../hooks';
import { t } from '../i18n';

const FILTER_KEYS = ['q', 'region', 'property_type', 'furnishing', 'min_price', 'max_price', 'min_beds', 'min_baths', 'min_area', 'max_area', 'available_now'];

export function Browse({ listingType }: { listingType: 'rent' | 'sale' }) {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const page = Number(params.get('page') ?? 1);

  const apiQuery = new URLSearchParams(params);
  apiQuery.set('listing_type', listingType);
  const { data, setData, loading, error } = useApi<Paged<Card>>(`/properties?${apiQuery}`);
  const toggle = useFavoriteToggle((id, fav) =>
    setData((d) => d && { ...d, items: d.items.map((p) => (p.id === id ? { ...p, is_favorite: fav } : p)) }),
  );

  /** Updates one or more query params; any filter change resets to page 1. */
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const toggleCsv = (key: string, value: string) => {
    const set = new Set((params.get(key) ?? '').split(',').filter(Boolean));
    set.has(value) ? set.delete(value) : set.add(value);
    update({ [key]: [...set].join(',') || null });
  };
  const has = (key: string, value: string) => (params.get(key) ?? '').split(',').includes(value);
  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;

  const [text, setText] = useState({ q: '', min_price: '', max_price: '', min_area: '', max_area: '' });
  useEffect(() => {
    setText({ q: params.get('q') ?? '', min_price: params.get('min_price') ?? '', max_price: params.get('max_price') ?? '', min_area: params.get('min_area') ?? '', max_area: params.get('max_area') ?? '' });
  }, [params]);
  const applyText = (e?: FormEvent) => {
    e?.preventDefault();
    update(Object.fromEntries(Object.entries(text).map(([k, v]) => [k, v.trim() || null])));
    setFiltersOpen(false);
  };

  const isRent = listingType === 'rent';
  const pricePlaceholders = isRent ? ['10,000', '150,000'] : ['1,000,000', '50,000,000'];

  return (
    <div className="container">
      <header className="page-head">
        <p className="eyebrow">{isRent ? 'Rent' : 'Buy'} · Ethiopia</p>
        <h1 className="h1" style={{ marginTop: 10 }}>{isRent ? 'Homes and spaces for rent' : 'Property for sale'}</h1>
        <div className="seg" style={{ marginTop: 20 }}>
          <Link to={`/rent${params.get('q') ? `?q=${encodeURIComponent(params.get('q')!)}` : ''}`} className={isRent ? 'on' : ''}>Rent</Link>
          <Link to={`/buy${params.get('q') ? `?q=${encodeURIComponent(params.get('q')!)}` : ''}`} className={!isRent ? 'on' : ''}>Buy</Link>
        </div>
      </header>

      <div className="browse">
        <form className={`filters ${filtersOpen ? 'open' : ''}`} onSubmit={applyText} aria-label="Filters">
          <div className="row" style={{ marginBottom: 16 }}>
            <strong>Filters</strong>
            <span className="spacer" />
            {activeCount > 0 && <button type="button" className="link small" onClick={() => setParams(new URLSearchParams())}>Clear all</button>}
            <button type="button" className="icon-btn filters-toggle" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button>
          </div>

          <fieldset>
            <Field label="Location">
              <input className="input" value={text.q} onChange={(e) => setText({ ...text, q: e.target.value })} placeholder="Bole, CMC, Hawassa…" />
            </Field>
          </fieldset>
          <fieldset>
            <Field label="Region">
              <select className="select" value={params.get('region') ?? ''} onChange={(e) => update({ region: e.target.value || null })}>
                <option value="">All regions</option>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </fieldset>
          <fieldset>
            <legend>Property type</legend>
            <div className="chips">
              {PROPERTY_TYPES.map((pt) => (
                <button key={pt} type="button" className="chip" aria-pressed={has('property_type', pt)} onClick={() => toggleCsv('property_type', pt)}>{label(pt)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Price (ETB{isRent ? ' per month' : ''})</legend>
            <div className="grid-2" style={{ gap: 8 }}>
              <input className="input" inputMode="numeric" aria-label="Minimum price" placeholder={`Min ${pricePlaceholders[0]}`} value={text.min_price} onChange={(e) => setText({ ...text, min_price: e.target.value.replace(/\D/g, '') })} />
              <input className="input" inputMode="numeric" aria-label="Maximum price" placeholder={`Max ${pricePlaceholders[1]}`} value={text.max_price} onChange={(e) => setText({ ...text, max_price: e.target.value.replace(/\D/g, '') })} />
            </div>
          </fieldset>
          {(['min_beds', 'min_baths'] as const).map((key) => (
            <fieldset key={key}>
              <legend>{key === 'min_beds' ? 'Bedrooms' : 'Bathrooms'}</legend>
              <div className="chips">
                {['', '1', '2', '3', '4'].map((n) => (
                  <button key={n} type="button" className="chip" aria-pressed={(params.get(key) ?? '') === n} onClick={() => update({ [key]: n || null })}>{n ? `${n}+` : 'Any'}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset>
            <legend>Area (m²)</legend>
            <div className="grid-2" style={{ gap: 8 }}>
              <input className="input" inputMode="numeric" aria-label="Minimum area" placeholder="Min" value={text.min_area} onChange={(e) => setText({ ...text, min_area: e.target.value.replace(/\D/g, '') })} />
              <input className="input" inputMode="numeric" aria-label="Maximum area" placeholder="Max" value={text.max_area} onChange={(e) => setText({ ...text, max_area: e.target.value.replace(/\D/g, '') })} />
            </div>
          </fieldset>
          <fieldset>
            <legend>Furnishing</legend>
            <div className="chips">
              {['furnished', 'semi_furnished', 'unfurnished'].map((f) => (
                <button key={f} type="button" className="chip" aria-pressed={has('furnishing', f)} onClick={() => toggleCsv('furnishing', f)}>{label(f)}</button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <label className="check">
              <input type="checkbox" checked={params.get('available_now') === 'true'} onChange={(e) => update({ available_now: e.target.checked ? 'true' : null })} />
              Available now
            </label>
          </fieldset>
          <button className="btn btn-block" type="submit">Apply filters</button>
        </form>

        <section aria-live="polite" aria-busy={loading}>
          <div className="toolbar">
            <span className="muted">{data ? `${data.total} ${data.total === 1 ? 'property' : 'properties'}` : 'Searching…'}</span>
            <div className="row">
              <button className="btn btn-ghost btn-sm filters-toggle" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={16} aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ''}
              </button>
              <label className="row small">
                <span className="muted">Sort</span>
                <select className="select" style={{ height: 38, width: 'auto' }} value={params.get('sort') ?? 'newest'} onChange={(e) => update({ sort: e.target.value })}>
                  <option value="newest">Newest first</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="area_desc">Largest area</option>
                </select>
              </label>
            </div>
          </div>

          {error && <EmptyState icon={SearchX} title="Search is unavailable">{error}</EmptyState>}
          {!error && data && data.items.length === 0 && (
            <EmptyState icon={SearchX} title={t('empty.results')}>
              <p>{t('empty.resultsHint')}</p>
              {activeCount > 0 && <button className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>}
            </EmptyState>
          )}
          <div className="cards">
            {loading && !data && Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
            {data?.items.map((p) => <PropertyCard key={p.id} p={p} onToggleFavorite={toggle} />)}
          </div>

          {data && data.total_pages > 1 && (
            <nav className="pagination" aria-label="Pagination">
              <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} aria-label="Previous page">‹</button>
              {Array.from({ length: data.total_pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === data.total_pages || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <span key={n} className="row" style={{ gap: 6 }}>
                    {i > 0 && n - arr[i - 1] > 1 && <span className="muted">…</span>}
                    <button aria-current={n === page ? 'page' : undefined} onClick={() => update({ page: String(n) })}>{n}</button>
                  </span>
                ))}
              <button disabled={page >= data.total_pages} onClick={() => update({ page: String(page + 1) })} aria-label="Next page">›</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
