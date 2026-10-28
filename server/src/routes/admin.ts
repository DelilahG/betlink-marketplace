import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { query, withTransaction } from '../db.js';
import { ah, HttpError, isUuid, notFound } from '../lib/http.js';

/** Moderation endpoints. requireRole('admin') runs server-side on every request. */
export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

const uuidParam = (id: string) => {
  if (!isUuid(id)) throw notFound();
  return id;
};

adminRouter.get(
  '/stats',
  ah(async (_req, res) => {
    const { rows } = await query(`SELECT
      (SELECT count(*) FROM users) AS users,
      (SELECT count(*) FROM properties WHERE status = 'published') AS published,
      (SELECT count(*) FROM properties WHERE moderation_status = 'flagged') AS flagged,
      (SELECT count(*) FROM reports WHERE status = 'open') AS open_reports,
      (SELECT count(*) FROM users WHERE verification_status = 'pending') AS pending_verifications`);
    res.json(rows[0]);
  }),
);

adminRouter.get(
  '/properties',
  ah(async (req, res) => {
    const f = z
      .object({
        moderation: z.enum(['ok', 'flagged', 'removed']).optional(),
        q: z.string().trim().max(80).optional(),
      })
      .parse(req.query);
    const { rows } = await query(
      `SELECT p.id, p.title, p.listing_type, p.city, p.subcity, p.price_etb, p.rent_period, p.status,
         p.moderation_status, p.verification_status, p.is_demo, p.created_at, u.full_name AS owner_name, u.email AS owner_email,
         (SELECT count(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'open') AS open_reports
       FROM properties p JOIN users u ON u.id = p.owner_id
       WHERE ($1::text IS NULL OR p.moderation_status = $1)
         AND ($2::text IS NULL OR p.title ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
       ORDER BY (p.moderation_status = 'flagged') DESC, p.created_at DESC LIMIT 200`,
      [f.moderation ?? null, f.q || null],
    );
    res.json({ items: rows });
  }),
);

adminRouter.patch(
  '/properties/:id',
  ah(async (req, res) => {
    const input = z
      .object({
        moderation_status: z.enum(['ok', 'flagged', 'removed']).optional(),
        verification_status: z.enum(['unverified', 'verified']).optional(),
      })
      .parse(req.body);
    const { rows } = await query(
      `UPDATE properties SET
         moderation_status = COALESCE($2, moderation_status),
         verification_status = COALESCE($3, verification_status),
         status = CASE WHEN $2 = 'removed' AND status = 'published' THEN 'unpublished' ELSE status END,
         updated_at = now()
       WHERE id = $1 RETURNING id, status, moderation_status, verification_status`,
      [uuidParam(req.params.id), input.moderation_status ?? null, input.verification_status ?? null],
    );
    if (!rows[0]) throw notFound('Listing');
    res.json({ property: rows[0] });
  }),
);

adminRouter.get(
  '/reports',
  ah(async (req, res) => {
    const status = z.enum(['open', 'resolved', 'dismissed']).default('open').parse(req.query.status);
    const { rows } = await query(
      `SELECT r.id, r.reason, r.details, r.status, r.created_at, p.id AS property_id, p.title AS property_title,
         p.moderation_status, u.full_name AS reporter_name
       FROM reports r JOIN properties p ON p.id = r.property_id JOIN users u ON u.id = r.reporter_user_id
       WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 200`,
      [status],
    );
    res.json({ items: rows });
  }),
);

adminRouter.patch(
  '/reports/:id',
  ah(async (req, res) => {
    const input = z
      .object({ status: z.enum(['resolved', 'dismissed']), remove_listing: z.boolean().default(false) })
      .parse(req.body);
    const id = uuidParam(req.params.id);
    const report = await withTransaction(async (c) => {
      const r = await c.query(
        'UPDATE reports SET status = $2, resolved_by = $3 WHERE id = $1 RETURNING id, status, property_id',
        [id, input.status, req.user!.id],
      );
      if (!r.rows[0]) throw notFound('Report');
      if (input.remove_listing) {
        if (input.status !== 'resolved') throw new HttpError(400, 'Only a resolved report can remove a listing');
        await c.query(
          `UPDATE properties SET moderation_status = 'removed',
             status = CASE WHEN status = 'published' THEN 'unpublished' ELSE status END, updated_at = now()
           WHERE id = $1`,
          [r.rows[0].property_id],
        );
      }
      return r.rows[0];
    });
    res.json({ report });
  }),
);

adminRouter.get(
  '/users',
  ah(async (req, res) => {
    const q = z.string().trim().max(80).optional().parse(req.query.q);
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.verification_status, u.is_suspended, u.created_at,
         (SELECT count(*) FROM properties p WHERE p.owner_id = u.id) AS listing_count
       FROM users u
       WHERE ($1::text IS NULL OR u.email ILIKE '%' || $1 || '%' OR u.full_name ILIKE '%' || $1 || '%')
       ORDER BY (u.verification_status = 'pending') DESC, u.created_at DESC LIMIT 200`,
      [q || null],
    );
    res.json({ items: rows });
  }),
);

adminRouter.patch(
  '/users/:id',
  ah(async (req, res) => {
    const input = z
      .object({
        verification_status: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
        is_suspended: z.boolean().optional(),
      })
      .parse(req.body);
    const id = uuidParam(req.params.id);
    if (id === req.user!.id && input.is_suspended) throw new HttpError(400, 'You cannot suspend your own account');
    const { rows } = await query(
      `UPDATE users SET verification_status = COALESCE($2, verification_status),
         is_suspended = COALESCE($3, is_suspended), updated_at = now()
       WHERE id = $1 RETURNING id, verification_status, is_suspended`,
      [id, input.verification_status ?? null, input.is_suspended ?? null],
    );
    if (!rows[0]) throw notFound('User');
    if (input.is_suspended) await query('DELETE FROM sessions WHERE user_id = $1', [id]);
    res.json({ user: rows[0] });
  }),
);
