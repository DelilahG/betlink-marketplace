-- BetLink initial schema
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  phone text CHECK (phone ~ '^\+251[0-9]{9}$'),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner','agent','admin')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  is_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 8 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 30 AND 5000),
  listing_type text NOT NULL CHECK (listing_type IN ('rent','sale')),
  property_type text NOT NULL CHECK (property_type IN
    ('apartment','condominium','house','villa','guesthouse','commercial','office','land')),
  price_etb numeric(14,2) NOT NULL CHECK (price_etb > 0),
  rent_period text CHECK (rent_period IN ('month','year')),
  deposit_months smallint CHECK (deposit_months BETWEEN 0 AND 24),
  min_lease_months smallint CHECK (min_lease_months BETWEEN 1 AND 120),
  region text NOT NULL,
  city text NOT NULL,
  subcity text,
  neighborhood text,
  address_line text,
  bedrooms smallint NOT NULL DEFAULT 0 CHECK (bedrooms BETWEEN 0 AND 50),
  bathrooms smallint NOT NULL DEFAULT 0 CHECK (bathrooms BETWEEN 0 AND 50),
  area_sqm numeric(10,2) NOT NULL CHECK (area_sqm > 0),
  furnishing text NOT NULL DEFAULT 'unfurnished' CHECK (furnishing IN ('furnished','semi_furnished','unfurnished')),
  water_supply text NOT NULL DEFAULT 'unknown' CHECK (water_supply IN ('continuous','scheduled','tank_backup','unknown')),
  electricity text NOT NULL DEFAULT 'unknown' CHECK (electricity IN ('stable','generator_backup','intermittent','unknown')),
  parking_spaces smallint NOT NULL DEFAULT 0 CHECK (parking_spaces BETWEEN 0 AND 100),
  amenities text[] NOT NULL DEFAULT '{}',
  available_from date,
  contact_phone text CHECK (contact_phone ~ '^\+251[0-9]{9}$'),
  contact_whatsapp boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished','rented','sold')),
  moderation_status text NOT NULL DEFAULT 'ok' CHECK (moderation_status IN ('ok','flagged','removed')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','verified')),
  is_demo boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- rent listings need a period, sale listings must not have rent-only fields
  CONSTRAINT rent_fields CHECK (
    (listing_type = 'rent' AND rent_period IS NOT NULL) OR
    (listing_type = 'sale' AND rent_period IS NULL AND deposit_months IS NULL AND min_lease_months IS NULL)
  ),
  CONSTRAINT rented_only_rent CHECK (status <> 'rented' OR listing_type = 'rent'),
  CONSTRAINT sold_only_sale CHECK (status <> 'sold' OR listing_type = 'sale')
);
CREATE INDEX properties_search_idx ON properties (status, listing_type, price_etb);
CREATE INDEX properties_location_idx ON properties (lower(city), lower(subcity));
CREATE INDEX properties_created_idx ON properties (created_at DESC);
CREATE INDEX properties_owner_idx ON properties (owner_id);
CREATE INDEX properties_amenities_idx ON properties USING gin (amenities);

CREATE TABLE property_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  storage_key text,            -- set for uploaded files; null for external (seed) images
  credit text,
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_images_property_idx ON property_images (property_id, position);

CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);
CREATE INDEX favorites_property_idx ON favorites (property_id);

CREATE TABLE inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text CHECK (phone ~ '^\+251[0-9]{9}$'),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','responded','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_property_idx ON inquiries (property_id, created_at DESC);
CREATE INDEX inquiries_sender_idx ON inquiries (sender_user_id);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('scam','inaccurate','duplicate','unavailable','offensive','other')),
  details text CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, reporter_user_id)
);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);
