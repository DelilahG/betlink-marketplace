export type Role = 'user' | 'owner' | 'agent' | 'admin';
export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  verification_status: string;
  created_at: string;
}

export interface PropertyCard {
  id: string;
  title: string;
  listing_type: 'rent' | 'sale';
  property_type: string;
  price_etb: number;
  rent_period: 'month' | 'year' | null;
  region: string;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  bedrooms: number;
  bathrooms: number;
  area_sqm: number;
  furnishing: string;
  status: string;
  verification_status: string;
  is_demo: boolean;
  available_from: string | null;
  created_at: string;
  published_at: string | null;
  cover_url: string | null;
  owner_name: string;
  owner_role: Role;
  owner_verification: string;
  is_favorite?: boolean;
}

export interface MyListing extends PropertyCard {
  moderation_status: string;
  view_count: number;
  inquiry_count: number;
  new_inquiry_count: number;
  favorite_count: number;
  updated_at: string;
}

export interface PropertyImage {
  id: string;
  url: string;
  credit: string | null;
  position: number;
}

export interface Property extends PropertyCard {
  description: string;
  deposit_months: number | null;
  min_lease_months: number | null;
  address_line: string | null;
  water_supply: string;
  electricity: string;
  parking_spaces: number;
  amenities: string[];
  contact_phone: string | null;
  contact_whatsapp: boolean;
  moderation_status: string;
  view_count: number;
  owner_since: string;
  images: PropertyImage[];
  is_owner: boolean;
}

export interface Paged<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Thin fetch wrapper: same-origin cookies, JSON in/out, CSRF header on every request, typed errors. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'BetLink', ...(opts.body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: isForm ? (opts.body as FormData) : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Request failed', data.fields);
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
