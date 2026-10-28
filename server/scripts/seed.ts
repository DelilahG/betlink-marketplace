/**
 * Development seed: demo accounts and clearly-labelled demonstration listings.
 * Listings are fictional; photos are stock images from Unsplash (Unsplash License) and do not show the described
 * properties. Demo listings deliberately have no phone number, so no contact details are fabricated.
 */
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { pool, withTransaction } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

if (config.isProd) {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) {
  console.error('Set SEED_PASSWORD (8+ characters) in server/.env before seeding.');
  process.exit(1);
}

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=80`;
const P = {
  modern: '1600596542815-ffad4c1539a9', exterior: '1600585154340-be6161a56a0c', luxury: '1512917774080-9991f1c4c750',
  house: '1564013799919-ab600027ffc6', aptInterior: '1502672260266-1c1ef2d93688', living: '1522708323590-d24dbb6b0267',
  interior: '1560448204-e02f11c3d0e2', loft: '1493809842364-78817add7ffb', kitchen: '1484154218962-a197022b5858',
  bedroom: '1505691938895-1758d7feb511', lounge: '1586023492125-27b2c045efd7', suburban: '1570129477492-45c003edd2be',
  villa: '1580587771525-78b9dba3b914', pool: '1613490493576-7fde63acd811', block: '1545324418-cc1a3fa10c00',
  tower: '1486406146926-c627a92ad1ab', office: '1497366216548-37526070297c', kitchen2: '1556909114-f6e7ad7d3136',
  dining: '1600607687939-ce8a6c25118c', bath: '1600566753190-17f0baa2a6c3', patio: '1600210492486-724fe5c67fb0',
  flat: '1460317442991-0ec209397118', terrace: '1567496898669-ee935f5f647a', land: '1558036117-15d82a90b9b1',
};

type Seed = {
  t: string; d: string; lt: 'rent' | 'sale'; pt: string; price: number; region: string; city: string;
  sub?: string; hood?: string; beds: number; baths: number; area: number; furn: string; water: string; elec: string;
  park: number; am: string[]; imgs: (keyof typeof P)[]; owner: 'owner' | 'agent'; dep?: number; lease?: number;
};

const L: Seed[] = [
  { t: 'Bright two-bedroom apartment near Bole Atlas', d: 'Fourth-floor apartment a short walk from Atlas and Edna Mall, with an open living room, a fitted kitchen and a balcony facing east. The building has a lift, a standby generator for common areas and a guard at the gate day and night.', lt: 'rent', pt: 'apartment', price: 65000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Bole', hood: 'Atlas', beds: 2, baths: 2, area: 110, furn: 'furnished', water: 'tank_backup', elec: 'generator_backup', park: 1, am: ['elevator', 'security_guard', 'backup_generator', 'balcony', 'internet'], imgs: ['living', 'kitchen', 'bedroom'], owner: 'agent', dep: 2, lease: 6 },
  { t: 'Family G+1 house with compound in CMC', d: 'Four-bedroom G+1 house on a quiet street off the CMC road. Large private compound with a small garden, servants quarters and covered parking for two cars. Suits a family or an embassy staff household.', lt: 'rent', pt: 'house', price: 120000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Yeka', hood: 'CMC', beds: 4, baths: 3, area: 320, furn: 'semi_furnished', water: 'tank_backup', elec: 'stable', park: 2, am: ['gated_compound', 'garden', 'servants_quarters', 'water_tank', 'security_guard'], imgs: ['house', 'lounge', 'dining'], owner: 'owner', dep: 3, lease: 12 },
  { t: 'Compact studio in Kazanchis for professionals', d: 'Efficient studio close to the UNECA compound and Kazanchis offices. Comes furnished with a bed, desk and kitchenette. Internet-ready, with water storage on the roof.', lt: 'rent', pt: 'apartment', price: 28000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Kirkos', hood: 'Kazanchis', beds: 0, baths: 1, area: 42, furn: 'furnished', water: 'tank_backup', elec: 'intermittent', park: 0, am: ['internet', 'water_tank', 'security_guard'], imgs: ['loft', 'aptInterior'], owner: 'agent', dep: 1, lease: 3 },
  { t: 'Three-bedroom condominium for sale in Ayat', d: 'Title-deed condominium unit on the second floor of a completed Ayat block. Three bedrooms, a separate kitchen and a covered balcony. Shared parking and a guarded compound. Price is negotiable for a quick cash buyer.', lt: 'sale', pt: 'condominium', price: 4800000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Yeka', hood: 'Ayat', beds: 3, baths: 1, area: 88, furn: 'unfurnished', water: 'scheduled', elec: 'stable', park: 1, am: ['gated_compound', 'security_guard', 'balcony'], imgs: ['block', 'flat', 'kitchen2'], owner: 'owner' },
  { t: 'Contemporary villa with pool in Old Airport', d: 'Five-bedroom villa on a 600 m² plot in the Old Airport area, finished in 2021. Double-height living room, landscaped garden, swimming pool and a separate guest wing. Solar water heating and full generator backup.', lt: 'sale', pt: 'villa', price: 38000000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Kolfe Keranio', hood: 'Old Airport', beds: 5, baths: 5, area: 450, furn: 'semi_furnished', water: 'continuous', elec: 'generator_backup', park: 3, am: ['swimming_pool', 'garden', 'backup_generator', 'solar_water_heater', 'cctv', 'gated_compound'], imgs: ['pool', 'villa', 'bath'], owner: 'agent' },
  { t: 'Ground-floor office suite on Bole Road', d: 'Open-plan office of about 240 m² with two meeting rooms, a reception area and a kitchenette. Fibre internet is available in the building and there is dedicated parking for four vehicles.', lt: 'rent', pt: 'office', price: 180000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Bole', hood: 'Bole Road', beds: 0, baths: 2, area: 240, furn: 'unfurnished', water: 'continuous', elec: 'generator_backup', park: 4, am: ['elevator', 'backup_generator', 'cctv', 'internet', 'security_guard'], imgs: ['office', 'tower'], owner: 'agent', dep: 3, lease: 24 },
  { t: 'Street-front shop space in Piassa', d: 'Retail unit with wide street frontage in historic Piassa, suitable for a café, pharmacy or showroom. Includes a back storeroom and a small mezzanine office.', lt: 'rent', pt: 'commercial', price: 95000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Arada', hood: 'Piassa', beds: 0, baths: 1, area: 85, furn: 'unfurnished', water: 'scheduled', elec: 'stable', park: 0, am: ['cctv'], imgs: ['interior', 'terrace'], owner: 'owner', dep: 3, lease: 12 },
  { t: 'Quiet two-bedroom flat in Sarbet', d: 'Well-kept flat in a small residential building near Sarbet, ten minutes from Mexico Square. Two bedrooms, one bathroom and a sunny living area. Water storage tank and a guard on site.', lt: 'rent', pt: 'apartment', price: 42000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Nifas Silk-Lafto', hood: 'Sarbet', beds: 2, baths: 1, area: 95, furn: 'unfurnished', water: 'tank_backup', elec: 'stable', park: 1, am: ['water_tank', 'security_guard'], imgs: ['aptInterior', 'kitchen'], owner: 'owner', dep: 2, lease: 12 },
  { t: 'Modern townhouse for sale in Gerji', d: 'Four-bedroom townhouse in a gated development in Gerji. Fitted kitchen, rooftop terrace with city views and two parking spaces. Close to international schools and supermarkets.', lt: 'sale', pt: 'house', price: 21500000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Bole', hood: 'Gerji', beds: 4, baths: 3, area: 260, furn: 'unfurnished', water: 'tank_backup', elec: 'generator_backup', park: 2, am: ['gated_compound', 'cctv', 'backup_generator', 'balcony'], imgs: ['modern', 'kitchen2', 'patio'], owner: 'agent' },
  { t: 'Residential plot near Legetafo', d: 'A 250 m² residential plot in a growing neighbourhood just outside Addis Ababa on the Legetafo side. Road access and electricity lines nearby. Buyers should verify the lease documents with the municipality.', lt: 'sale', pt: 'land', price: 9500000, region: 'Oromia', city: 'Legetafo', hood: 'Legetafo', beds: 0, baths: 0, area: 250, furn: 'unfurnished', water: 'unknown', elec: 'unknown', park: 0, am: [], imgs: ['land'], owner: 'owner' },
  { t: 'Lakeside guesthouse business in Bahir Dar', d: 'Operating eight-room guesthouse a short walk from the Lake Tana shoreline. Each room has its own bathroom, plus a dining room, garden courtyard and staff quarters. Sold as a going concern.', lt: 'sale', pt: 'guesthouse', price: 22000000, region: 'Amhara', city: 'Bahir Dar', hood: 'Kebele 14', beds: 8, baths: 9, area: 540, furn: 'furnished', water: 'continuous', elec: 'generator_backup', park: 4, am: ['garden', 'backup_generator', 'solar_water_heater', 'internet'], imgs: ['suburban', 'dining', 'bedroom'], owner: 'agent' },
  { t: 'Garden house for rent in Hawassa', d: 'Three-bedroom bungalow with a mature garden in a calm part of Hawassa, near the lake and Piassa. Reliable water supply, covered parking and a separate outdoor kitchen.', lt: 'rent', pt: 'house', price: 35000, region: 'Sidama', city: 'Hawassa', hood: 'Tabor', beds: 3, baths: 2, area: 180, furn: 'semi_furnished', water: 'continuous', elec: 'stable', park: 1, am: ['garden', 'gated_compound'], imgs: ['exterior', 'lounge'], owner: 'owner', dep: 2, lease: 12 },
  { t: 'New two-bedroom apartment for sale in Adama', d: 'Recently completed apartment on the fifth floor of a mixed-use building in central Adama. Lift access, a balcony and an allocated parking bay in the basement.', lt: 'sale', pt: 'apartment', price: 6200000, region: 'Oromia', city: 'Adama', hood: 'Posta Bet', beds: 2, baths: 2, area: 105, furn: 'unfurnished', water: 'scheduled', elec: 'stable', park: 1, am: ['elevator', 'balcony', 'cctv'], imgs: ['flat', 'living'], owner: 'agent' },
  { t: 'Spacious villa for rent in Dire Dawa', d: 'Single-storey villa with four bedrooms, high ceilings and a shaded veranda in the Kezira area of Dire Dawa. Large compound with fruit trees and room for three cars.', lt: 'rent', pt: 'villa', price: 55000, region: 'Dire Dawa', city: 'Dire Dawa', hood: 'Kezira', beds: 4, baths: 3, area: 300, furn: 'unfurnished', water: 'tank_backup', elec: 'stable', park: 3, am: ['garden', 'gated_compound', 'water_tank'], imgs: ['villa', 'patio'], owner: 'owner', dep: 2, lease: 12 },
  { t: 'Furnished one-bedroom near Megenagna', d: 'Comfortable one-bedroom apartment within walking distance of Megenagna transport links. Furnished, with internet and a standby generator for the building.', lt: 'rent', pt: 'apartment', price: 38000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Yeka', hood: 'Megenagna', beds: 1, baths: 1, area: 65, furn: 'furnished', water: 'tank_backup', elec: 'generator_backup', park: 0, am: ['internet', 'backup_generator', 'elevator'], imgs: ['bedroom', 'interior'], owner: 'agent', dep: 1, lease: 6 },
  { t: 'Four-bedroom family home for sale in Summit', d: 'Detached G+1 house on a 300 m² plot in the Summit area. Four bedrooms, a family lounge, a separate service block and a paved compound. Title deed available for inspection.', lt: 'sale', pt: 'house', price: 17800000, region: 'Addis Ababa', city: 'Addis Ababa', sub: 'Bole', hood: 'Summit', beds: 4, baths: 3, area: 280, furn: 'unfurnished', water: 'tank_backup', elec: 'stable', park: 2, am: ['gated_compound', 'servants_quarters', 'water_tank'], imgs: ['suburban', 'dining', 'bath'], owner: 'owner' },
];

await runMigrations(pool, () => {});
const hash = await bcrypt.hash(password, 12);

await withTransaction(async (c) => {
  await c.query(`DELETE FROM users WHERE email LIKE '%@demo.betlink.test'`); // cascades to their listings
  const mk = async (email: string, name: string, role: string) =>
    (
      await c.query('INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id', [
        email, hash, name, role,
      ])
    ).rows[0].id as string;
  const owners = {
    owner: await mk('selam@demo.betlink.test', 'Selam Tesfaye (demo owner)', 'owner'),
    agent: await mk('dawit@demo.betlink.test', 'Dawit Bekele (demo agent)', 'agent'),
  };
  await mk('hana@demo.betlink.test', 'Hana Girma (demo renter)', 'user');

  for (const [i, s] of L.entries()) {
    const publishedAt = new Date(Date.now() - i * 2.3 * 86_400_000);
    const { rows } = await c.query(
      `INSERT INTO properties (owner_id, title, description, listing_type, property_type, price_etb, rent_period,
         deposit_months, min_lease_months, region, city, subcity, neighborhood, bedrooms, bathrooms, area_sqm,
         furnishing, water_supply, electricity, parking_spaces, amenities, status, is_demo, published_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'published',true,$22,$22)
       RETURNING id`,
      [
        owners[s.owner], s.t, s.d, s.lt, s.pt, s.price, s.lt === 'rent' ? 'month' : null, s.dep ?? null, s.lease ?? null,
        s.region, s.city, s.sub ?? null, s.hood ?? null, s.beds, s.baths, s.area, s.furn, s.water, s.elec, s.park, s.am,
        publishedAt,
      ],
    );
    for (const [pos, key] of s.imgs.entries()) {
      await c.query('INSERT INTO property_images (property_id, url, credit, position) VALUES ($1, $2, $3, $4)', [
        rows[0].id, img(P[key]), 'Stock photo via Unsplash (illustrative only)', pos,
      ]);
    }
  }
});
console.log(`Seeded ${L.length} demo listings. Demo logins (password = SEED_PASSWORD): selam@, dawit@, hana@demo.betlink.test`);
await pool.end();
