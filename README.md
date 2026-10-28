# BetLink — Ethiopian Property Marketplace

BetLink is a full-stack marketplace for renting and buying property in Ethiopia. Visitors can search and filter listings. Registered users can save homes and send inquiries. Owners and agents can manage their listings, and administrators can moderate content. All prices are in birr (ETB), areas are in m², phone numbers use +251, and locations are organised by region, city, subcity and neighbourhood.

> Student portfolio project. There are no payments. Demo listings are fictional and clearly labelled, and their photos are illustrative stock images from Unsplash.

## Features

- **Discovery:** separate Rent and Buy pages, a location search covering subcity, neighbourhood, city and region, and filters for type, price, bedrooms, bathrooms, area, furnishing and "available now". You can sort by newest, price or area. Pagination happens on the server and the state lives in the URL, so searches can be shared.
- **Listing pages:** a photo gallery with a keyboard-accessible lightbox, key facts, Ethiopian details (water supply, electricity, parking, deposit, minimum lease), amenities, location and a lister card. There are call and WhatsApp links only when the lister has shared a number. You can send an inquiry, save the listing or report it.
- **Accounts:** register, log in and log out. Roles are user, owner, agent and admin. You can edit your profile and request verification, and see your saved homes and the inquiries you have sent.
- **Owner/agent dashboard:** create a draft, preview it live, upload photos, then publish. You can also edit, unpublish, mark as rented or sold, and delete. The dashboard shows views, inquiries and saves per listing, and you can manage incoming inquiries (new, responded, closed).
- **Administration:** stats, listing moderation (restore, remove, verify), a report queue (dismiss, resolve, resolve and remove) and user verification and suspension.
- **Honest verification:** nothing is marked verified unless an administrator does it. Unverified items are labelled "Not verified".

## Architecture

```
betlink-marketplace/
├─ server/                Express + TypeScript API
│  ├─ migrations/         Plain SQL migrations (001_init.sql)
│  ├─ scripts/            local-db, migrate, seed, create-admin
│  ├─ src/
│  │  ├─ app.ts           Middleware, routes, error handling
│  │  ├─ auth.ts          DB-backed sessions, role guards
│  │  ├─ validation.ts    Zod schemas (one source of truth for input rules)
│  │  ├─ routes/          auth, properties, account (favourites/inquiries), admin
│  │  └─ lib/             phone normalisation, image checks, rate limits
│  └─ tests/              Vitest + Supertest against a real PostgreSQL
└─ client/                React + TypeScript + Vite
   └─ src/
      ├─ pages/           Home, Browse, PropertyDetail, Auth, Account, Dashboard, ListingEditor, Admin
      ├─ components/      Layout, PropertyCard, UI primitives (states, badges, reveal motion)
      ├─ api.ts           Typed fetch wrapper
      ├─ format.ts        ETB, m², +251 helpers and labels
      ├─ i18n.ts          UI strings (add an Amharic dictionary here)
      └─ styles.css       Design system (tokens, components, motion)
```

- **Request flow:** React calls `/api/*`. Vite proxies those calls in development, and Express serves both the API and the built client in production. The routes validate input with Zod and use parameterised SQL through `pg`.
- **Database:** tables for users, sessions, properties, property_images, favorites, inquiries and reports. CHECK constraints enforce enums, the +251 phone format and the rent/sale rules. There are indexes for search, location, owner and amenities. Multi-step writes (delete, upload, report plus auto-flag, moderation) run in transactions.
- **Design:** an editorial look inspired by the Relatora real-estate template: warm ivory paper, ink type, one berbere-red accent, Instrument Serif headings with Inter for body text, image-led cards, large rounded hero photography and scroll-reveal motion that respects `prefers-reduced-motion`. Icons come from Lucide (ISC licence).

## Prerequisites (Windows)

- Node.js 20 or newer (tested with Node 24) and npm.
- PostgreSQL. You can use **either** of these:
  - **A. No install (recommended for a quick start):** `npm run db:local` runs a real PostgreSQL server from the `embedded-postgres` npm package. Data is stored in `server/.pgdata` and no admin rights are needed.
  - **B. Installed PostgreSQL 14+:** use the installer from postgresql.org. Then, in `psql -U postgres`, run:
    ```sql
    CREATE USER betlink WITH PASSWORD 'choose-a-password';
    CREATE DATABASE betlink OWNER betlink;
    ```

## Setup and run (PowerShell)

```powershell
cd C:\Users\<you>\Projects\betlink-marketplace
npm install
Copy-Item server\.env.example server\.env
# Edit server\.env: set DATABASE_URL and SEED_PASSWORD
```

**Terminal 1, the database (option A only):**
```powershell
npm run db:local
# Prints: DATABASE_URL=postgres://betlink:betlink_local_dev@localhost:5433/betlink  (paste into server\.env)
```

**Terminal 2, schema, demo data and an admin:**
```powershell
npm run db:migrate
npm run db:seed
$env:ADMIN_PASSWORD = "a-long-password-of-your-choice"
npm run create-admin -- --email admin@example.com --name "Your Name"
Remove-Item Env:ADMIN_PASSWORD
```

**Development (two terminals):**
```powershell
npm run dev:server    # API on http://localhost:4000 (runs migrations on start)
npm run dev:client    # App on http://localhost:5173
```

**Production build (one server):**
```powershell
npm run build
npm start             # http://localhost:4000 serves both the API and the built app
```

**Demo logins** (the password is your `SEED_PASSWORD`): `selam@demo.betlink.test` (owner), `dawit@demo.betlink.test` (agent), `hana@demo.betlink.test` (renter).

## Tests

```powershell
npm test          # server + client
npm run typecheck
npm run build
```

- **Server (49 tests):** these run against a throwaway **real PostgreSQL** that the tests start automatically. They cover registration and login validation, phone normalisation, the CSRF header, profile-based privilege escalation, role checks, listing CRUD and the draft → publish → rented flow, cross-user access (403), upload rejection (spoofed type, more than 5 MB, path-traversal filename), search and filters, sorting and pagination, LIKE wildcard escaping, favourites, the inquiry workflow and honeypot, reporting with auto-flagging, admin moderation, verification and suspension.
- **Client (7 tests):** ETB and phone formatting, listing form validation, and PropertyCard rendering (labels, the verified badge only when verified, the favourite toggle).

## Security

- Passwords are hashed with bcrypt (cost 12). Login uses a dummy hash for unknown emails so response timing does not reveal which accounts exist.
- Sessions use random 256-bit tokens in `HttpOnly`, `SameSite=Lax` cookies (also `Secure` in production). The database stores only the SHA-256 of each token. Logout and suspension delete sessions.
- **CSRF:** every non-GET API request must send `X-Requested-With: BetLink`. Cross-site pages cannot send that header without a CORS preflight, and the server never grants one.
- **Authorization runs on the server for every action:** role guards, ownership checks on every listing mutation, inquiry updates scoped to the listing owner, and admin routes behind `requireRole('admin')`. Hiding buttons in the UI is for convenience only.
- All input goes through Zod, and all SQL is parameterised. Helmet sets security headers and a CSP. JSON bodies are limited to 100 KB.
- Rate limits apply to login/registration, inquiries, reports and uploads. Inquiries also have a honeypot field. Each user can report a listing once, and three reports flag it automatically.
- **Uploads:** only owners can upload. Files are held in memory, limited to 8 per request, 5 MB each and 12 per listing. The type is checked from the file's **magic bytes** (JPEG, PNG or WebP), not from the client-supplied MIME type or filename. Files are stored under random hex names outside the source tree and served with `nosniff` and `default-src 'none'`. Stored keys are validated with a regex before any delete.
- **Admin creation:** `create-admin` is a CLI script that refuses to run when `NODE_ENV=production`. It reads the password from an environment variable. There is no hardcoded password and no web backdoor. The seed script also refuses to run in production.
- `.env`, `server/.pgdata` and uploads are git-ignored. `.env.example` contains placeholders only.

## Known limitations

- **Image storage is local disk** (`server/uploads`). In production, use object storage such as S3 or R2 and a CDN, scan uploads for malware, and strip EXIF data (which can contain GPS location). Images are not resized.
- **No email delivery:** listers see inquiries in the dashboard and reply by email or phone themselves. Password reset is not implemented.
- **Verification is a manual admin flag.** A real deployment would need ID or licence document checks and an audit trail.
- **View counts are approximate** (they count every non-owner page load, without deduplication).
- **Search uses `ILIKE`.** For large datasets, add `pg_trgm` or full-text indexes, plus map-based search with coordinates.
- **The interface is English only for now.** Strings are centralised in `client/src/i18n.ts` so Amharic can be added, but not every string has moved there yet.
- **Demo photos** are hotlinked from `images.unsplash.com` under the [Unsplash License](https://unsplash.com/license). They are generic interiors and exteriors, not Ethiopian properties, and individual photographer credits were not recorded.
- Rate-limit counters are kept in memory (one process). Use a Redis store if you scale out.
- No end-to-end browser test suite. Tests cover the API (integration) and React components (unit).
