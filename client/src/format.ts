import { t } from './i18n';

const group = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "ETB 65,000" — full figure, used on detail pages and forms. */
export const formatBirr = (amount: number) => `ETB ${group.format(amount)}`;

/** "ETB 4.8M" / "ETB 950K" — compact figure for dense cards. */
export function formatBirrCompact(amount: number) {
  if (amount >= 1_000_000) return `ETB ${+(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 1 : 2)}M`;
  if (amount >= 100_000) return `ETB ${+(amount / 1000).toFixed(0)}K`;
  return formatBirr(amount);
}

export function priceLabel(p: { price_etb: number; listing_type: string; rent_period: string | null }, compact = false) {
  const amount = compact ? formatBirrCompact(p.price_etb) : formatBirr(p.price_etb);
  if (p.listing_type !== 'rent') return { amount, suffix: '' };
  return { amount, suffix: p.rent_period === 'year' ? t('listing.perYear') : t('listing.perMonth') };
}

/** "+251 91 123 4567" for display. Input must already be normalized E.164. */
export const formatPhone = (e164: string) => e164.replace(/^\+251(\d{2})(\d{3})(\d{4})$/, '+251 $1 $2 $3');

export const telLink = (e164: string) => `tel:${e164}`;
/** wa.me opens a chat with the number; nothing is sent automatically. */
export const whatsappLink = (e164: string, text: string) =>
  `https://wa.me/${e164.replace('+', '')}?text=${encodeURIComponent(text)}`;
export const isMobile = (e164: string) => /^\+251[79]\d{8}$/.test(e164);

export const formatArea = (sqm: number) => `${group.format(sqm)} m²`;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export const LABELS: Record<string, string> = {
  apartment: 'Apartment', condominium: 'Condominium', house: 'House', villa: 'Villa', guesthouse: 'Guesthouse',
  commercial: 'Commercial', office: 'Office', land: 'Land',
  furnished: 'Furnished', semi_furnished: 'Semi-furnished', unfurnished: 'Unfurnished',
  continuous: 'Continuous supply', scheduled: 'Scheduled supply', tank_backup: 'Tank backup', unknown: 'Not specified',
  stable: 'Stable', generator_backup: 'Generator backup', intermittent: 'Intermittent',
  security_guard: 'Security guard', cctv: 'CCTV', elevator: 'Elevator', backup_generator: 'Backup generator',
  water_tank: 'Water tank', balcony: 'Balcony', garden: 'Garden', servants_quarters: 'Servants quarters',
  internet: 'Internet ready', gym: 'Gym', swimming_pool: 'Swimming pool', gated_compound: 'Gated compound',
  solar_water_heater: 'Solar water heater', kitchen_appliances: 'Kitchen appliances',
  draft: 'Draft', published: 'Published', unpublished: 'Unpublished', rented: 'Rented', sold: 'Sold',
  rent: 'For rent', sale: 'For sale', owner: 'Owner', agent: 'Agent', user: 'Member', admin: 'Administrator',
  ok: 'OK', flagged: 'Flagged', removed: 'Removed', new: 'New', responded: 'Responded', closed: 'Closed',
  open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed',
  verified: 'Verified', unverified: 'Unverified', pending: 'Pending review', rejected: 'Rejected',
  scam: 'Possible scam', inaccurate: 'Inaccurate details', duplicate: 'Duplicate', offensive: 'Offensive content',
  other: 'Other',
};
export const label = (key: string | null | undefined) => (key ? (LABELS[key] ?? key) : '');

export const REGIONS = [
  'Addis Ababa', 'Dire Dawa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Gambella', 'Harari',
  'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'South West Ethiopia Peoples', 'Tigray',
];
export const ADDIS_SUBCITIES = [
  'Addis Ketema', 'Akaki Kaliti', 'Arada', 'Bole', 'Gulele', 'Kirkos', 'Kolfe Keranio', 'Lemi Kura', 'Lideta',
  'Nifas Silk-Lafto', 'Yeka',
];
export const PROPERTY_TYPES = ['apartment', 'condominium', 'house', 'villa', 'guesthouse', 'commercial', 'office', 'land'];
export const AMENITIES = [
  'security_guard', 'cctv', 'elevator', 'backup_generator', 'water_tank', 'balcony', 'garden', 'servants_quarters',
  'internet', 'gym', 'swimming_pool', 'gated_compound', 'solar_water_heater', 'kitchen_appliances',
];
