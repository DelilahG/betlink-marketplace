import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

const app = createApp();
const H = { 'X-Requested-With': 'BetLink' };
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type Agent = ReturnType<typeof request.agent>;
async function signup(email: string, role: 'user' | 'owner' | 'agent' = 'user'): Promise<Agent> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .set(H)
    .send({ email, password: 'correct horse battery', full_name: `Test ${role}`, role });
  expect(res.status).toBe(201);
  return agent;
}

const listing = (over: Record<string, unknown> = {}) => ({
  title: 'Sunny two-bedroom apartment in Bole',
  description: 'A bright apartment close to Edna Mall with a balcony, a fitted kitchen and a guard on duty.',
  listing_type: 'rent',
  property_type: 'apartment',
  price_etb: 50000,
  rent_period: 'month',
  region: 'Addis Ababa',
  city: 'Addis Ababa',
  subcity: 'Bole',
  neighborhood: 'Atlas',
  bedrooms: 2,
  bathrooms: 1,
  area_sqm: 90,
  furnishing: 'furnished',
  water_supply: 'tank_backup',
  electricity: 'stable',
  parking_spaces: 1,
  amenities: ['balcony', 'security_guard'],
  contact_phone: '0911 234 567',
  contact_whatsapp: true,
  ...over,
});

async function createPublished(agent: Agent, over: Record<string, unknown> = {}) {
  const created = await agent.post('/api/properties').set(H).send(listing(over));
  expect(created.status).toBe(201);
  const id = created.body.property.id;
  await agent.post(`/api/properties/${id}/images`).set(H).attach('images', PNG, 'photo.png').expect(201);
  await agent.post(`/api/properties/${id}/status`).set(H).send({ status: 'published' }).expect(200);
  return id as string;
}

let owner: Agent, otherOwner: Agent, renter: Agent, admin: Agent;

beforeAll(async () => {
  await runMigrations(pool, () => {});
  await pool.query('TRUNCATE users CASCADE');
  owner = await signup('owner@example.com', 'owner');
  otherOwner = await signup('agent@example.com', 'agent');
  renter = await signup('renter@example.com');
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES ('admin@example.com', $1, 'Admin', 'admin')`,
    [await bcrypt.hash('admin password 123', 4)],
  );
  admin = request.agent(app);
  await admin.post('/api/auth/login').set(H).send({ email: 'admin@example.com', password: 'admin password 123' }).expect(200);
});

afterAll(async () => {
  await pool.end();
});

describe('authentication', () => {
  it('rejects invalid registration input with field errors', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'nope', password: 'short', full_name: 'A', phone: '12345' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['email', 'password', 'full_name', 'phone']));
  });

  it('normalizes Ethiopian phone numbers and never returns the password hash', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'Phone@Example.com', password: 'long enough pw', full_name: 'Abebe Kebede', phone: '0911-23-45-67' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'phone@example.com', phone: '+251911234567', role: 'user' });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  });

  it('prevents duplicate emails (case-insensitive) and self-registration as admin', async () => {
    const dup = await request(app)
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'OWNER@example.com', password: 'whatever123', full_name: 'Dup' });
    expect(dup.status).toBe(409);
    const adm = await request(app)
      .post('/api/auth/register')
      .set(H)
      .send({ email: 'x@example.com', password: 'whatever123', full_name: 'X', role: 'admin' });
    expect(adm.status).toBe(400);
  });

  it('logs in, reports the session user, and logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').set(H).send({ email: 'renter@example.com', password: 'wrong' }).expect(401);
    await agent.post('/api/auth/login').set(H).send({ email: 'renter@example.com', password: 'correct horse battery' }).expect(200);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('renter@example.com');
    await agent.post('/api/auth/logout').set(H).expect(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('rejects state-changing requests without the CSRF header', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'renter@example.com', password: 'x' });
    expect(res.status).toBe(403);
  });

  it('lets users update their profile but not promote themselves to admin', async () => {
    const res = await renter.patch('/api/auth/me').set(H).send({ full_name: 'Hana G', role: 'admin' });
    expect(res.status).toBe(400);
    const ok = await renter.patch('/api/auth/me').set(H).send({ full_name: 'Hana G', request_verification: true });
    expect(ok.body.user).toMatchObject({ full_name: 'Hana G', verification_status: 'pending', role: 'user' });
  });
});

describe('listing management', () => {
  let draftId: string;

  it('only owners, agents and admins can create listings', async () => {
    await renter.post('/api/properties').set(H).send(listing()).expect(403);
    await request(app).post('/api/properties').set(H).send(listing()).expect(401);
  });

  it('validates listing input', async () => {
    const res = await owner
      .post('/api/properties')
      .set(H)
      .send(listing({ price_etb: -5, rent_period: null, region: 'Atlantis', contact_phone: '555' }));
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['price_etb', 'region', 'contact_phone']));
  });

  it('creates a draft with normalized contact phone, hidden from the public', async () => {
    const res = await owner.post('/api/properties').set(H).send(listing());
    expect(res.status).toBe(201);
    expect(res.body.property).toMatchObject({ status: 'draft', contact_phone: '+251911234567', verification_status: 'unverified' });
    draftId = res.body.property.id;
    await request(app).get(`/api/properties/${draftId}`).expect(404);
    expect((await owner.get(`/api/properties/${draftId}`)).body.property.is_owner).toBe(true);
  });

  it('clears rent-only fields on sale listings', async () => {
    const res = await owner
      .post('/api/properties')
      .set(H)
      .send(listing({ listing_type: 'sale', price_etb: 5_000_000, rent_period: 'month', deposit_months: 2 }));
    expect(res.body.property).toMatchObject({ rent_period: null, deposit_months: null });
  });

  it('requires a photo before publishing and rejects non-image uploads', async () => {
    const pub = await owner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'published' });
    expect(pub.status).toBe(400);
    const bad = await owner
      .post(`/api/properties/${draftId}/images`)
      .set(H)
      .attach('images', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' });
    expect(bad.status).toBe(400);
    const big = await owner
      .post(`/api/properties/${draftId}/images`)
      .set(H)
      .attach('images', Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), 'big.png');
    expect(big.status).toBe(400);
    expect(big.body.error).toMatch(/5 MB/);
  });

  it('uploads a real image under a random name and publishes', async () => {
    const up = await owner.post(`/api/properties/${draftId}/images`).set(H).attach('images', PNG, '../../etc/passwd.png');
    expect(up.status).toBe(201);
    expect(up.body.images[0].url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
    const served = await request(app).get(up.body.images[0].url);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    await owner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'published' }).expect(200);
    const pub = await request(app).get(`/api/properties/${draftId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.property.images).toHaveLength(1);
  });

  it('blocks other users from modifying the listing', async () => {
    await otherOwner.patch(`/api/properties/${draftId}`).set(H).send({ price_etb: 1 }).expect(403);
    await otherOwner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'unpublished' }).expect(403);
    await otherOwner.post(`/api/properties/${draftId}/images`).set(H).attach('images', PNG, 'x.png').expect(403);
    await otherOwner.delete(`/api/properties/${draftId}`).set(H).expect(403);
    await renter.delete(`/api/properties/${draftId}`).set(H).expect(403);
  });

  it('lets the owner edit, mark rented, and enforces status rules', async () => {
    const edit = await owner.patch(`/api/properties/${draftId}`).set(H).send({ price_etb: 55000 });
    expect(edit.body.property.price_etb).toBe(55000);
    await owner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'sold' }).expect(400);
    await owner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'rented' }).expect(200);
    await owner.post(`/api/properties/${draftId}/status`).set(H).send({ status: 'published' }).expect(200);
    const mine = await owner.get('/api/properties/mine');
    expect(mine.body.items.map((p: { id: string }) => p.id)).toContain(draftId);
  });

  it('deletes a listing and its images', async () => {
    const id = await createPublished(owner, { title: 'Listing that will be deleted' });
    await owner.delete(`/api/properties/${id}`).set(H).expect(204);
    await owner.get(`/api/properties/${id}`).expect(404);
  });
});

describe('search and filters', () => {
  beforeAll(async () => {
    await createPublished(otherOwner, { title: 'Large villa for sale in Old Airport', listing_type: 'sale', property_type: 'villa', price_etb: 30_000_000, rent_period: null, subcity: 'Kolfe Keranio', neighborhood: 'Old Airport', bedrooms: 5, bathrooms: 4, area_sqm: 450, furnishing: 'unfurnished' });
    await createPublished(otherOwner, { title: 'Cheap studio flat in Kazanchis', price_etb: 20000, subcity: 'Kirkos', neighborhood: 'Kazanchis', bedrooms: 0, area_sqm: 40 });
    await createPublished(otherOwner, { title: 'Family house to rent in Hawassa', property_type: 'house', price_etb: 35000, region: 'Sidama', city: 'Hawassa', subcity: null, neighborhood: 'Tabor', bedrooms: 3, area_sqm: 180, furnishing: 'semi_furnished' });
  });

  const search = (qs: string) => request(app).get(`/api/properties?${qs}`);

  it('separates rent and sale listings', async () => {
    const rent = await search('listing_type=rent');
    expect(rent.body.items.every((p: { listing_type: string }) => p.listing_type === 'rent')).toBe(true);
    const sale = await search('listing_type=sale');
    expect(sale.body.items.map((p: { title: string }) => p.title)).toEqual(['Large villa for sale in Old Airport']);
  });

  it('filters by location text, price, bedrooms, type and furnishing', async () => {
    expect((await search('q=kazanchis')).body.items).toHaveLength(1);
    expect((await search('q=hawassa')).body.items[0].city).toBe('Hawassa');
    const priced = await search('listing_type=rent&min_price=30000&max_price=40000');
    expect(priced.body.items.map((p: { price_etb: number }) => p.price_etb)).toEqual([35000]);
    expect((await search('min_beds=4')).body.total).toBe(1);
    expect((await search('property_type=house,villa')).body.total).toBe(2);
    expect((await search('furnishing=semi_furnished')).body.total).toBe(1);
    expect((await search('min_area=400')).body.items[0].property_type).toBe('villa');
  });

  it('treats LIKE wildcards in the query as plain text', async () => {
    expect((await search('q=%25')).body.total).toBe(0);
  });

  it('sorts and paginates on the server', async () => {
    const asc = await search('listing_type=rent&sort=price_asc');
    const prices = asc.body.items.map((p: { price_etb: number }) => p.price_etb);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const page = await search('page_size=2&page=2&sort=price_desc');
    expect(page.body).toMatchObject({ page: 2, page_size: 2 });
    expect(page.body.items.length).toBeLessThanOrEqual(2);
    expect(page.body.total_pages).toBe(Math.ceil(page.body.total / 2));
  });

  it('rejects invalid filter values', async () => {
    await search('sort=hacker').expect(400);
    await search('property_type=castle').expect(400);
  });
});

describe('favourites', () => {
  let id: string;
  beforeAll(async () => {
    id = (await search()).body.items[0].id;
    async function search() {
      return request(app).get('/api/properties?listing_type=sale');
    }
  });

  it('requires login', async () => {
    await request(app).put(`/api/me/favorites/${id}`).set(H).expect(401);
  });

  it('saves, lists, reflects in search, and removes favourites idempotently', async () => {
    await renter.put(`/api/me/favorites/${id}`).set(H).expect(204);
    await renter.put(`/api/me/favorites/${id}`).set(H).expect(204);
    const list = await renter.get('/api/me/favorites');
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([id]);
    const s = await renter.get('/api/properties?listing_type=sale');
    expect(s.body.items[0].is_favorite).toBe(true);
    await renter.delete(`/api/me/favorites/${id}`).set(H).expect(204);
    expect((await renter.get('/api/me/favorites')).body.items).toHaveLength(0);
  });

  it('returns 404 for unknown listings', async () => {
    await renter.put('/api/me/favorites/00000000-0000-0000-0000-000000000000').set(H).expect(404);
  });
});

describe('inquiries', () => {
  let id: string;
  let inquiryId: string;
  beforeAll(async () => {
    id = await createPublished(owner, { title: 'Apartment receiving inquiries' });
  });

  it('validates inquiries', async () => {
    const res = await request(app).post(`/api/properties/${id}/inquiries`).set(H).send({ name: 'A', email: 'x', message: 'hi' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['name', 'email', 'message']));
  });

  it('accepts anonymous and logged-in inquiries', async () => {
    await request(app)
      .post(`/api/properties/${id}/inquiries`)
      .set(H)
      .send({ name: 'Meron Alemu', email: 'meron@example.com', message: 'Is this still available next month?' })
      .expect(201);
    const res = await renter
      .post(`/api/properties/${id}/inquiries`)
      .set(H)
      .send({ name: 'Hana G', email: 'renter@example.com', phone: '+251 912 345 678', message: 'Could I visit on Saturday morning?' });
    expect(res.status).toBe(201);
    inquiryId = res.body.inquiry.id;
  });

  it('silently drops honeypot submissions', async () => {
    await request(app)
      .post(`/api/properties/${id}/inquiries`)
      .set(H)
      .send({ name: 'Bot', email: 'bot@example.com', message: 'Buy cheap followers now!!!', website: 'http://spam' })
      .expect(201);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM inquiries WHERE property_id = $1', [id]);
    expect(rows[0].n).toBe(2);
  });

  it('stops owners from inquiring about their own listing', async () => {
    await owner
      .post(`/api/properties/${id}/inquiries`)
      .set(H)
      .send({ name: 'Me', email: 'owner@example.com', message: 'Talking to myself here.' })
      .expect(400);
  });

  it('shows senders their sent inquiries and owners their received ones', async () => {
    const sent = await renter.get('/api/me/inquiries/sent');
    expect(sent.body.items[0]).toMatchObject({ property_id: id, status: 'new' });
    const received = await owner.get('/api/me/inquiries/received');
    expect(received.body.items).toHaveLength(2);
    expect((await otherOwner.get('/api/me/inquiries/received')).body.items).toHaveLength(0);
  });

  it('only the listing owner can update an inquiry', async () => {
    await otherOwner.patch(`/api/me/inquiries/${inquiryId}`).set(H).send({ status: 'closed' }).expect(404);
    await renter.patch(`/api/me/inquiries/${inquiryId}`).set(H).send({ status: 'closed' }).expect(404);
    const ok = await owner.patch(`/api/me/inquiries/${inquiryId}`).set(H).send({ status: 'responded' });
    expect(ok.body.inquiry.status).toBe('responded');
  });
});

describe('reports and administration', () => {
  let id: string;
  beforeAll(async () => {
    id = await createPublished(owner, { title: 'Suspicious listing to be reported' });
  });

  it('accepts one report per user and auto-flags after three', async () => {
    await request(app).post(`/api/properties/${id}/reports`).set(H).send({ reason: 'scam' }).expect(401);
    await renter.post(`/api/properties/${id}/reports`).set(H).send({ reason: 'scam', details: 'Asked for a deposit by phone' }).expect(201);
    await renter.post(`/api/properties/${id}/reports`).set(H).send({ reason: 'scam' }).expect(409);
    await owner.post(`/api/properties/${id}/reports`).set(H).send({ reason: 'scam' }).expect(400);
    await otherOwner.post(`/api/properties/${id}/reports`).set(H).send({ reason: 'inaccurate' }).expect(201);
    const third = await signup('third@example.com');
    await third.post(`/api/properties/${id}/reports`).set(H).send({ reason: 'duplicate' }).expect(201);
    const { rows } = await pool.query('SELECT moderation_status FROM properties WHERE id = $1', [id]);
    expect(rows[0].moderation_status).toBe('flagged');
  });

  it('denies admin endpoints to non-admins', async () => {
    await renter.get('/api/admin/reports').expect(403);
    await owner.patch(`/api/admin/properties/${id}`).set(H).send({ moderation_status: 'ok' }).expect(403);
    await request(app).get('/api/admin/users').expect(401);
  });

  it('lets admins resolve a report by removing the listing, which the owner cannot undo', async () => {
    const reports = await admin.get('/api/admin/reports');
    const report = reports.body.items.find((r: { property_id: string }) => r.property_id === id);
    await admin.patch(`/api/admin/reports/${report.id}`).set(H).send({ status: 'resolved', remove_listing: true }).expect(200);
    await request(app).get(`/api/properties/${id}`).expect(404);
    const republish = await owner.post(`/api/properties/${id}/status`).set(H).send({ status: 'published' });
    expect(republish.status).toBe(403);
  });

  it('lets admins verify listings and users explicitly', async () => {
    const listingId = (await request(app).get('/api/properties?listing_type=sale')).body.items[0].id;
    const v = await admin.patch(`/api/admin/properties/${listingId}`).set(H).send({ verification_status: 'verified' });
    expect(v.body.property.verification_status).toBe('verified');
    const users = await admin.get('/api/admin/users');
    const pending = users.body.items.find((u: { email: string }) => u.email === 'renter@example.com');
    expect(pending.verification_status).toBe('pending');
    const u = await admin.patch(`/api/admin/users/${pending.id}`).set(H).send({ verification_status: 'verified' });
    expect(u.body.user.verification_status).toBe('verified');
  });

  it('suspending a user ends their sessions', async () => {
    const victim = await signup('spammer@example.com');
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'spammer@example.com'`);
    await admin.patch(`/api/admin/users/${rows[0].id}`).set(H).send({ is_suspended: true }).expect(200);
    expect((await victim.get('/api/auth/me')).body.user).toBeNull();
  });
});
