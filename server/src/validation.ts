import { z } from 'zod';
import { normalizeEthiopianPhone } from './lib/phone.js';

export const REGIONS = [
  'Addis Ababa', 'Dire Dawa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Gambella', 'Harari',
  'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'South West Ethiopia Peoples', 'Tigray',
] as const;
export const PROPERTY_TYPES = ['apartment', 'condominium', 'house', 'villa', 'guesthouse', 'commercial', 'office', 'land'] as const;
export const AMENITIES = [
  'security_guard', 'cctv', 'elevator', 'backup_generator', 'water_tank', 'balcony', 'garden', 'servants_quarters',
  'internet', 'gym', 'swimming_pool', 'gated_compound', 'solar_water_heater', 'kitchen_appliances',
] as const;
export const FURNISHING = ['furnished', 'semi_furnished', 'unfurnished'] as const;

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeEthiopianPhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid Ethiopian phone number, e.g. 0911 234 567 or +251 911 234 567' });
      return z.NEVER;
    }
    return n;
  });
/** Empty string / null / undefined -> null, otherwise must be a valid Ethiopian number. */
const optionalPhone = z
  .union([z.literal(''), z.null(), phoneSchema])
  .optional()
  .transform((v) => (v ? v : null));

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const registerSchema = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  full_name: trimmed(2, 100),
  phone: optionalPhone,
  role: z.enum(['user', 'owner', 'agent']).default('user'),
});

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

export const profileSchema = z.object({
  full_name: trimmed(2, 100).optional(),
  phone: optionalPhone,
  role: z.enum(['user', 'owner', 'agent']).optional(),
  request_verification: z.boolean().optional(),
});

const intRange = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

const propertyBase = z.object({
  title: trimmed(8, 120),
  description: trimmed(30, 5000),
  listing_type: z.enum(['rent', 'sale']),
  property_type: z.enum(PROPERTY_TYPES),
  price_etb: z.coerce.number().positive('Price must be greater than zero').max(1e12),
  rent_period: z.enum(['month', 'year']).nullable().optional(),
  deposit_months: intRange(0, 24).nullable().optional(),
  min_lease_months: intRange(1, 120).nullable().optional(),
  region: z.enum(REGIONS),
  city: trimmed(2, 80),
  subcity: optionalText(80),
  neighborhood: optionalText(80),
  address_line: optionalText(200),
  bedrooms: intRange(0, 50),
  bathrooms: intRange(0, 50),
  area_sqm: z.coerce.number().positive('Area must be greater than zero').max(1e7),
  furnishing: z.enum(FURNISHING),
  water_supply: z.enum(['continuous', 'scheduled', 'tank_backup', 'unknown']),
  electricity: z.enum(['stable', 'generator_backup', 'intermittent', 'unknown']),
  parking_spaces: intRange(0, 100),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).default([]).transform((a) => [...new Set(a)]),
  available_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  contact_phone: optionalPhone,
  contact_whatsapp: z.boolean().default(false),
});

/** Full listing payload. Rent-only fields are cleared for sales so the DB constraint always holds. */
export const propertySchema = propertyBase.transform((p, ctx) => {
  if (p.listing_type === 'rent' && !p.rent_period) {
    ctx.addIssue({ code: 'custom', path: ['rent_period'], message: 'Choose a rental period' });
    return z.NEVER;
  }
  if (p.listing_type === 'sale') {
    return { ...p, rent_period: null, deposit_months: null, min_lease_months: null, available_from: p.available_from ?? null };
  }
  return {
    ...p,
    deposit_months: p.deposit_months ?? null,
    min_lease_months: p.min_lease_months ?? null,
    available_from: p.available_from ?? null,
  };
});
export type PropertyInput = z.infer<typeof propertySchema>;
export const PROPERTY_FIELDS = Object.keys(propertyBase.shape) as (keyof PropertyInput)[];

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values)));

export const searchSchema = z.object({
  listing_type: z.enum(['rent', 'sale']).optional(),
  q: z.string().trim().max(80).optional(),
  region: z.enum(REGIONS).optional(),
  property_type: csv(PROPERTY_TYPES),
  furnishing: csv(FURNISHING),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().positive().optional(),
  min_beds: z.coerce.number().int().min(0).max(50).optional(),
  min_baths: z.coerce.number().int().min(0).max(50).optional(),
  min_area: z.coerce.number().nonnegative().optional(),
  max_area: z.coerce.number().positive().optional(),
  available_now: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'area_desc']).default('newest'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(24).default(12),
});

export const statusSchema = z.object({ status: z.enum(['published', 'unpublished', 'rented', 'sold', 'draft']) });

export const inquirySchema = z.object({
  name: trimmed(2, 100),
  email,
  phone: optionalPhone,
  message: trimmed(10, 2000),
  website: z.string().max(200).optional(), // honeypot: real users never fill this hidden field
});

export const inquiryStatusSchema = z.object({ status: z.enum(['new', 'responded', 'closed']) });

export const reportSchema = z.object({
  reason: z.enum(['scam', 'inaccurate', 'duplicate', 'unavailable', 'offensive', 'other']),
  details: optionalText(1000),
});
