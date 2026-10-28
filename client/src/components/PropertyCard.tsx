import { Bath, BedDouble, Heart, MapPin, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PropertyCard as Card } from '../api';
import { formatArea, label, priceLabel } from '../format';
import { t } from '../i18n';

export const locationLine = (p: Pick<Card, 'neighborhood' | 'subcity' | 'city'>) =>
  [p.neighborhood, p.subcity, p.city].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');

export function PropertyCard({ p, onToggleFavorite }: { p: Card; onToggleFavorite?: (p: Card) => void }) {
  const price = priceLabel(p, true);
  return (
    <article className="card">
      <div className="card-media">
        {p.cover_url ? <img src={p.cover_url} alt="" loading="lazy" /> : null}
        <div className="card-badges">
          <span className="badge badge-dark">{label(p.listing_type)}</span>
          {p.verification_status === 'verified' && <span className="badge badge-green">{t('listing.verified')}</span>}
          {p.is_demo && <span className="badge">{t('listing.demo')}</span>}
          {p.status === 'rented' || p.status === 'sold' ? <span className="badge badge-amber">{label(p.status)}</span> : null}
        </div>
        {onToggleFavorite && (
          <button
            type="button"
            className="icon-btn card-fav"
            aria-pressed={!!p.is_favorite}
            aria-label={p.is_favorite ? `Remove ${p.title} from saved` : `Save ${p.title}`}
            onClick={() => onToggleFavorite(p)}
          >
            <Heart size={18} fill={p.is_favorite ? 'var(--accent)' : 'none'} color={p.is_favorite ? 'var(--accent)' : 'currentColor'} />
          </button>
        )}
      </div>
      <div className="stack" style={{ ['--gap' as string]: '8px' }}>
        <div className="card-price">
          {price.amount}
          {price.suffix && <small>{price.suffix}</small>}
        </div>
        <Link to={`/properties/${p.id}`} className="card-title">{p.title}</Link>
        <div className="loc"><MapPin size={15} aria-hidden /> {locationLine(p)}</div>
        <div className="facts">
          {p.bedrooms > 0 && <span><BedDouble size={16} aria-hidden /> {p.bedrooms} bd</span>}
          {p.bathrooms > 0 && <span><Bath size={16} aria-hidden /> {p.bathrooms} ba</span>}
          <span><Ruler size={16} aria-hidden /> {formatArea(p.area_sqm)}</span>
          <span className="muted">{label(p.property_type)}</span>
        </div>
      </div>
    </article>
  );
}
