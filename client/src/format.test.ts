import { describe, expect, it } from 'vitest';
import { formatBirr, formatBirrCompact, formatPhone, isMobile, priceLabel, whatsappLink } from './format';
import { validateListing, type ListingForm } from './pages/ListingEditor';

describe('ETB formatting', () => {
  it('formats full and compact birr amounts', () => {
    expect(formatBirr(65000)).toBe('ETB 65,000');
    expect(formatBirrCompact(4_800_000)).toBe('ETB 4.8M');
    expect(formatBirrCompact(38_000_000)).toBe('ETB 38M');
    expect(formatBirrCompact(180_000)).toBe('ETB 180K');
    expect(formatBirrCompact(42_000)).toBe('ETB 42,000');
  });

  it('distinguishes monthly rent from one-time sale prices', () => {
    expect(priceLabel({ price_etb: 42000, listing_type: 'rent', rent_period: 'month' })).toEqual({ amount: 'ETB 42,000', suffix: '/ month' });
    expect(priceLabel({ price_etb: 5e6, listing_type: 'sale', rent_period: null }).suffix).toBe('');
  });
});

describe('phone helpers', () => {
  it('formats +251 numbers and builds WhatsApp links only for mobiles', () => {
    expect(formatPhone('+251911234567')).toBe('+251 91 123 4567');
    expect(isMobile('+251911234567')).toBe(true);
    expect(isMobile('+251111234567')).toBe(false);
    expect(whatsappLink('+251911234567', 'Hi there')).toBe('https://wa.me/251911234567?text=Hi%20there');
  });
});

describe('validateListing', () => {
  const base: ListingForm = {
    title: 'Two-bedroom flat in Sarbet', description: 'A quiet, well kept flat close to Mexico Square and shops.',
    listing_type: 'rent', property_type: 'apartment', price_etb: '42000', rent_period: 'month', deposit_months: '2',
    min_lease_months: '', region: 'Addis Ababa', city: 'Addis Ababa', subcity: 'Nifas Silk-Lafto', neighborhood: 'Sarbet',
    address_line: '', bedrooms: '2', bathrooms: '1', area_sqm: '95', furnishing: 'unfurnished', water_supply: 'unknown',
    electricity: 'unknown', parking_spaces: '1', amenities: [], available_from: '', contact_phone: '0911 234 567', contact_whatsapp: true,
  };
  it('accepts a complete listing', () => expect(validateListing(base)).toEqual({}));
  it('flags missing price, short text and a foreign phone number', () => {
    const e = validateListing({ ...base, title: 'Flat', description: 'short', price_etb: '', area_sqm: '0', contact_phone: '+1 202 555 0100' });
    expect(Object.keys(e).sort()).toEqual(['area_sqm', 'contact_phone', 'description', 'price_etb', 'title']);
  });
});
