import { Router, type Request } from 'express';
import type { SessionUser } from '../auth.js';
import { requireAuth, requireRole } from '../auth.js';
import { query, withTransaction } from '../db.js';
import { ah, forbidden, HttpError, isUuid, notFound } from '../lib/http.js';
import { imageUpload, MAX_IMAGES_PER_PROPERTY, removeImage, storeImage } from '../lib/images.js';
import { inquiryLimiter, reportLimiter, uploadLimiter } from '../lib/limits.js';
import {
  inquirySchema,
  PROPERTY_FIELDS,
  propertySchema,
  reportSchema,
  searchSchema,
  statusSchema,
} from '../validation.js';

export const propertiesRouter = Router();

export const CARD_COLUMNS = `p.id, p.title, p.listing_type, p.property_type, p.price_etb, p.rent_period, p.region, p.city,
  p.subcity, p.neighborhood, p.bedrooms, p.bathrooms, p.area_sqm, p.furnishing, p.status, p.verification_status,
  p.is_demo, p.available_from, p.created_at, p.published_at,
  (SELECT url FROM property_images i WHERE i.property_id = p.id ORDER BY position, created_at LIMIT 1) AS cover_url,
  u.full_name AS owner_name, u.role AS owner_role, u.verification_status AS owner_verification`;

const PUBLIC_VISIBLE = `p.moderation_status <> 'removed' AND p.status IN ('published','rented','sold')`;

const SORTS = {
  newest: 'p.published_at DESC NULLS LAST, p.created_at DESC',
  price_asc: 'p.price_etb ASC',
  price_desc: 'p.price_etb DESC',
  area_desc: 'p.area_sqm DESC',
} as const;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Loads a property and enforces that the caller owns it (admins may act on any listing). */
async function loadOwned(id: string, user: SessionUser) {
  if (!isUuid(id)) throw notFound('Listing');
  const { rows } = await query('SELECT * FROM properties WHERE id = $1', [id]);
  const p = rows[0];
  if (!p) throw notFound('Listing');
  if (p.owner_id !== user.id && user.role !== 'admin') throw forbidden('You can only manage your own listings');
  return p;
}

// ---- Search -------------------------------------------------------------------------------------
propertiesRouter.get(
  '/',
  ah(async (req, res) => {
    const f = searchSchema.parse(req.query);
    const params: unknown[] = [];
    const where = ["p.status = 'published'", "p.moderation_status <> 'removed'"];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (f.listing_type) add('p.listing_type = ?', f.listing_type);
    if (f.region) add('p.region = ?', f.region);
    if (f.q) {
      add(
        `(p.city ILIKE ? OR p.subcity ILIKE ? OR p.neighborhood ILIKE ? OR p.title ILIKE ? OR p.region ILIKE ?)`,
        `%${escapeLike(f.q)}%`,
      );
    }
    if (f.property_type.length) add('p.property_type = ANY(?)', f.property_type);
    if (f.furnishing.length) add('p.furnishing = ANY(?)', f.furnishing);
    if (f.min_price !== undefined) add('p.price_etb >= ?', f.min_price);
    if (f.max_price !== undefined) add('p.price_etb <= ?', f.max_price);
    if (f.min_beds !== undefined) add('p.bedrooms >= ?', f.min_beds);
    if (f.min_baths !== undefined) add('p.bathrooms >= ?', f.min_baths);
    if (f.min_area !== undefined) add('p.area_sqm >= ?', f.min_area);
    if (f.max_area !== undefined) add('p.area_sqm <= ?', f.max_area);
    if (f.available_now === 'true') where.push('(p.available_from IS NULL OR p.available_from <= CURRENT_DATE)');

    params.push(req.user?.id ?? null);
    const favParam = `$${params.length}`;
    params.push(f.page_size, (f.page - 1) * f.page_size);
    const { rows } = await query(
      `SELECT ${CARD_COLUMNS},
         EXISTS (SELECT 1 FROM favorites fv WHERE fv.property_id = p.id AND fv.user_id = ${favParam}) AS is_favorite,
         count(*) OVER () AS total_count
       FROM properties p JOIN users u ON u.id = p.owner_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${SORTS[f.sort]}, p.id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = rows[0]?.total_count ?? 0;
    res.json({
      items: rows.map(({ total_count: _t, ...r }) => r),
      page: f.page,
      page_size: f.page_size,
      total,
      total_pages: Math.ceil(total / f.page_size),
    });
  }),
);

// ---- Owner / agent dashboard ------------------------------------------------------------------
propertiesRouter.get(
  '/mine',
  requireAuth,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT ${CARD_COLUMNS}, p.moderation_status, p.view_count, p.updated_at,
         (SELECT count(*) FROM inquiries q WHERE q.property_id = p.id) AS inquiry_count,
         (SELECT count(*) FROM inquiries q WHERE q.property_id = p.id AND q.status = 'new') AS new_inquiry_count,
         (SELECT count(*) FROM favorites fv WHERE fv.property_id = p.id) AS favorite_count
       FROM properties p JOIN users u ON u.id = p.owner_id
       WHERE p.owner_id = $1 ORDER BY p.updated_at DESC`,
      [req.user!.id],
    );
    res.json({ items: rows });
  }),
);

// ---- Detail -------------------------------------------------------------------------------------
propertiesRouter.get(
  '/:id',
  ah(async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) throw notFound('Listing');
    const user = req.user;
    const { rows } = await query(
      `SELECT p.*, u.full_name AS owner_name, u.role AS owner_role, u.verification_status AS owner_verification,
         u.created_at AS owner_since,
         EXISTS (SELECT 1 FROM favorites fv WHERE fv.property_id = p.id AND fv.user_id = $2) AS is_favorite
       FROM properties p JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
      [id, user?.id ?? null],
    );
    const p = rows[0];
    if (!p) throw notFound('Listing');
    const isOwner = user && (user.id === p.owner_id || user.role === 'admin');
    const publiclyVisible = p.moderation_status !== 'removed' && ['published', 'rented', 'sold'].includes(p.status);
    if (!publiclyVisible && !isOwner) throw notFound('Listing');
    if (!isOwner) await query('UPDATE properties SET view_count = view_count + 1 WHERE id = $1', [id]);

    const images = (
      await query('SELECT id, url, credit, position FROM property_images WHERE property_id = $1 ORDER BY position, created_at', [id])
    ).rows;
    res.json({ property: { ...p, images, is_owner: !!isOwner } });
  }),
);

// ---- Create / update / delete -------------------------------------------------------------------
propertiesRouter.post(
  '/',
  requireRole('owner', 'agent', 'admin'),
  ah(async (req, res) => {
    const input = propertySchema.parse(req.body);
    const cols = PROPERTY_FIELDS;
    const { rows } = await query(
      `INSERT INTO properties (owner_id, ${cols.join(', ')})
       VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`,
      [req.user!.id, ...cols.map((c) => input[c])],
    );
    res.status(201).json({ property: rows[0] });
  }),
);

propertiesRouter.patch(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const existing = await loadOwned(req.params.id, req.user!);
    const current = Object.fromEntries(PROPERTY_FIELDS.map((c) => [c, existing[c]]));
    const input = propertySchema.parse({ ...current, ...req.body });
    const cols = PROPERTY_FIELDS;
    const { rows } = await query(
      `UPDATE properties SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [existing.id, ...cols.map((c) => input[c])],
    );
    res.json({ property: rows[0] });
  }),
);

propertiesRouter.post(
  '/:id/status',
  requireAuth,
  ah(async (req, res) => {
    const p = await loadOwned(req.params.id, req.user!);
    const { status } = statusSchema.parse(req.body);
    if (p.moderation_status === 'removed' && req.user!.role !== 'admin' && status === 'published')
      throw forbidden('This listing was removed by a moderator and cannot be republished');
    if (status === 'rented' && p.listing_type !== 'rent') throw new HttpError(400, 'Only rental listings can be marked as rented');
    if (status === 'sold' && p.listing_type !== 'sale') throw new HttpError(400, 'Only sale listings can be marked as sold');
    if (status === 'published') {
      const { rows } = await query('SELECT count(*) AS n FROM property_images WHERE property_id = $1', [p.id]);
      if (rows[0].n < 1) throw new HttpError(400, 'Add at least one photo before publishing');
    }
    const { rows } = await query(
      `UPDATE properties SET status = $2, updated_at = now(),
         published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
       WHERE id = $1 RETURNING *`,
      [p.id, status],
    );
    res.json({ property: rows[0] });
  }),
);

propertiesRouter.delete(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const p = await loadOwned(req.params.id, req.user!);
    const keys = await withTransaction(async (c) => {
      const imgs = await c.query('SELECT storage_key FROM property_images WHERE property_id = $1', [p.id]);
      await c.query('DELETE FROM properties WHERE id = $1', [p.id]); // cascades to images, favorites, inquiries, reports
      return imgs.rows.map((r) => r.storage_key as string | null);
    });
    await Promise.all(keys.map(removeImage));
    res.status(204).end();
  }),
);

// ---- Images -------------------------------------------------------------------------------------
propertiesRouter.post(
  '/:id/images',
  requireAuth,
  uploadLimiter,
  // Ownership is checked before multer buffers any file
  ah(async (req, _res, next) => {
    await loadOwned(req.params.id, req.user!);
    next();
  }),
  imageUpload.array('images', 8),
  ah(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw new HttpError(400, 'Choose at least one image to upload');
    const id = req.params.id;
    const { rows } = await query('SELECT count(*) AS n, COALESCE(max(position), -1) AS maxpos FROM property_images WHERE property_id = $1', [id]);
    if (rows[0].n + files.length > MAX_IMAGES_PER_PROPERTY)
      throw new HttpError(400, `A listing can have at most ${MAX_IMAGES_PER_PROPERTY} photos`);

    const keys: string[] = [];
    try {
      for (const f of files) keys.push(await storeImage(f.buffer));
      const images = await withTransaction(async (c) => {
        const out = [];
        for (const [i, key] of keys.entries()) {
          const r = await c.query(
            'INSERT INTO property_images (property_id, url, storage_key, position) VALUES ($1, $2, $3, $4) RETURNING id, url, position',
            [id, `/uploads/${key}`, key, rows[0].maxpos + 1 + i],
          );
          out.push(r.rows[0]);
        }
        await c.query('UPDATE properties SET updated_at = now() WHERE id = $1', [id]);
        return out;
      });
      res.status(201).json({ images });
    } catch (err) {
      await Promise.all(keys.map(removeImage));
      throw err;
    }
  }),
);

propertiesRouter.delete(
  '/:id/images/:imageId',
  requireAuth,
  ah(async (req, res) => {
    const p = await loadOwned(req.params.id, req.user!);
    if (!isUuid(req.params.imageId)) throw notFound('Image');
    const { rows } = await query('DELETE FROM property_images WHERE id = $1 AND property_id = $2 RETURNING storage_key', [
      req.params.imageId,
      p.id,
    ]);
    if (!rows[0]) throw notFound('Image');
    await removeImage(rows[0].storage_key);
    res.status(204).end();
  }),
);

// ---- Inquiries & reports on a listing -----------------------------------------------------------
async function loadPublic(req: Request) {
  if (!isUuid(req.params.id)) throw notFound('Listing');
  const { rows } = await query(`SELECT p.id, p.owner_id, p.status FROM properties p WHERE p.id = $1 AND ${PUBLIC_VISIBLE}`, [
    req.params.id,
  ]);
  if (!rows[0]) throw notFound('Listing');
  return rows[0];
}

propertiesRouter.post(
  '/:id/inquiries',
  inquiryLimiter,
  ah(async (req, res) => {
    const input = inquirySchema.parse(req.body);
    const p = await loadPublic(req);
    // Honeypot tripped: pretend success so bots learn nothing, but store nothing
    if (input.website) return res.status(201).json({ ok: true });
    if (p.status !== 'published') throw new HttpError(400, 'This property is no longer available');
    if (req.user?.id === p.owner_id) throw new HttpError(400, 'You cannot send an inquiry about your own listing');
    const { rows } = await query(
      `INSERT INTO inquiries (property_id, sender_user_id, name, email, phone, message)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, created_at`,
      [p.id, req.user?.id ?? null, input.name, input.email, input.phone, input.message],
    );
    res.status(201).json({ ok: true, inquiry: rows[0] });
  }),
);

propertiesRouter.post(
  '/:id/reports',
  requireAuth,
  reportLimiter,
  ah(async (req, res) => {
    const input = reportSchema.parse(req.body);
    const p = await loadPublic(req);
    if (p.owner_id === req.user!.id) throw new HttpError(400, 'You cannot report your own listing');
    const inserted = await withTransaction(async (c) => {
      const r = await c.query(
        `INSERT INTO reports (property_id, reporter_user_id, reason, details) VALUES ($1, $2, $3, $4)
         ON CONFLICT (property_id, reporter_user_id) DO NOTHING RETURNING id`,
        [p.id, req.user!.id, input.reason, input.details],
      );
      // Three independent open reports automatically flag the listing for moderator attention
      await c.query(
        `UPDATE properties SET moderation_status = 'flagged'
         WHERE id = $1 AND moderation_status = 'ok'
           AND (SELECT count(*) FROM reports WHERE property_id = $1 AND status = 'open') >= 3`,
        [p.id],
      );
      return r.rows[0];
    });
    if (!inserted) throw new HttpError(409, 'You have already reported this listing');
    res.status(201).json({ ok: true });
  }),
);
