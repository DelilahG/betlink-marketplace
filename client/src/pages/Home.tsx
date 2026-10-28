import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { Paged, PropertyCard as Card } from '../api';
import { PropertyCard } from '../components/PropertyCard';
import { CardSkeleton, Reveal } from '../components/ui';
import { useApi, useFavoriteToggle } from '../hooks';
import { t } from '../i18n';

const u = (id: string, w = 1600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

const AREAS = [
  { name: 'Bole', note: 'Apartments near the airport, Atlas and Edna Mall', q: 'Bole', img: '1545324418-cc1a3fa10c00' },
  { name: 'Yeka', note: 'CMC compounds and Ayat condominiums', q: 'Yeka', img: '1564013799919-ab600027ffc6' },
  { name: 'Kirkos', note: 'Kazanchis studios for professionals', q: 'Kirkos', img: '1493809842364-78817add7ffb' },
  { name: 'Nifas Silk-Lafto', note: 'Quiet flats around Sarbet', q: 'Nifas Silk', img: '1502672260266-1c1ef2d93688' },
  { name: 'Beyond Addis', note: 'Hawassa, Bahir Dar, Adama, Dire Dawa', q: '', img: '1570129477492-45c003edd2be', to: '/buy' },
];

export function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'rent' | 'buy'>('rent');
  const [q, setQ] = useState('');
  const recent = useApi<Paged<Card>>('/properties?page_size=6&sort=newest');
  const rentCount = useApi<Paged<Card>>('/properties?listing_type=rent&page_size=1');
  const saleCount = useApi<Paged<Card>>('/properties?listing_type=sale&page_size=1');
  const toggle = useFavoriteToggle((id, fav) =>
    recent.setData((d) => d && { ...d, items: d.items.map((p) => (p.id === id ? { ...p, is_favorite: fav } : p)) }),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/${mode}${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <>
      <section className="hero container">
        <div className="hero-frame">
          <img src={u('1600596542815-ffad4c1539a9', 2200)} alt="" {...{ fetchpriority: 'high' }} />
          <div className="hero-content">
            <Reveal><p className="eyebrow">{t('hero.eyebrow')}</p></Reveal>
            <Reveal delay={80}>
              <h1 className="display" style={{ maxWidth: '11ch', marginTop: 14 }}>
                Find the place you will <em className="serif">call home</em>
              </h1>
            </Reveal>
            <Reveal delay={160}><p className="lede">{t('hero.body')}</p></Reveal>
            <Reveal delay={240}>
              <div className="search-panel">
                <form onSubmit={submit} role="search">
                  <div className="seg" role="tablist" aria-label="Rent or buy">
                    {(['rent', 'buy'] as const).map((m) => (
                      <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                        {m === 'rent' ? t('nav.rent') : t('nav.buy')}
                      </button>
                    ))}
                  </div>
                  <label className="search-input">
                    <Search size={18} aria-hidden className="muted" />
                    <span className="sr-only">Location</span>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search.placeholder')} />
                  </label>
                  <button className="btn btn-accent" type="submit">{t('search.submit')}</button>
                </form>
              </div>
            </Reveal>
          </div>
        </div>
        <div className="hero-stats">
          <div><strong>{rentCount.data?.total ?? '—'}</strong><span className="muted small">homes for rent right now</span></div>
          <div><strong>{saleCount.data?.total ?? '—'}</strong><span className="muted small">properties for sale</span></div>
          <div><strong>ETB</strong><span className="muted small">every price shown in birr, no surprises</span></div>
        </div>
      </section>

      <section className="section container" aria-labelledby="recent-h">
        <div className="section-head">
          <Reveal>
            <p className="eyebrow">Recently listed</p>
            <h2 id="recent-h" className="h2">Fresh on BetLink this month</h2>
          </Reveal>
          <Link to="/rent" className="btn btn-ghost">View all listings <ArrowRight size={16} aria-hidden /></Link>
        </div>
        <div className="cards">
          {recent.loading && Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
          {recent.error && <p className="muted">Listings could not be loaded right now. {recent.error}</p>}
          {recent.data?.items.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 90}><PropertyCard p={p} onToggleFavorite={toggle} /></Reveal>
          ))}
          {recent.data && recent.data.items.length === 0 && <p className="muted">No listings yet — be the first to list a property.</p>}
        </div>
      </section>

      <section className="section container" aria-labelledby="areas-h" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <Reveal>
            <p className="eyebrow">Neighbourhoods</p>
            <h2 id="areas-h" className="h2">Start with where you want to live</h2>
          </Reveal>
        </div>
        <div className="tiles">
          {AREAS.map((a) => (
            <Link key={a.name} className="tile" to={a.to ?? `/rent?q=${encodeURIComponent(a.q)}`}>
              <img src={u(a.img, 1200)} alt="" loading="lazy" />
              <div>
                <div className="h2">{a.name}</div>
                <div className="small" style={{ opacity: 0.85 }}>{a.note}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="split">
          <Reveal className="split-media"><img src={u('1600210492486-724fe5c67fb0', 1400)} alt="" loading="lazy" /></Reveal>
          <Reveal delay={120}>
            <p className="eyebrow">How BetLink works</p>
            <h2 className="h2" style={{ marginTop: 12 }}>Straightforward, from first search to first visit</h2>
            <ol className="steps">
              <li><div><div className="h3">Search with real filters</div><p className="muted">Subcity, budget in birr, bedrooms, furnishing, water and power situation — the details that matter here.</p></div></li>
              <li><div><div className="h3">Save and compare</div><p className="muted">Keep a shortlist of homes and come back to it on any device.</p></div></li>
              <li><div><div className="h3">Contact the owner or agent</div><p className="muted">Send an inquiry, or call and WhatsApp when the lister has shared a number. We never ask you to pay through BetLink.</p></div></li>
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="container">
        <Reveal className="cta-band">
          <div>
            <p className="eyebrow" style={{ color: 'rgba(244,239,230,.6)' }}>For owners and agents</p>
            <h2 className="h1" style={{ marginTop: 12, maxWidth: '14ch' }}>List your property in minutes</h2>
            <p className="lede" style={{ marginTop: 16 }}>Draft, preview and publish with photos. Manage inquiries in one place and mark it rented or sold when you are done.</p>
          </div>
          <Link to="/register?role=owner" className="btn btn-light">Start listing <ArrowUpRight size={16} aria-hidden /></Link>
        </Reveal>
      </section>
    </>
  );
}
