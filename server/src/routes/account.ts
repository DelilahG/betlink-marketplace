import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { query } from '../db.js';
import { ah, isUuid, notFound } from '../lib/http.js';
import { inquiryStatusSchema } from '../validation.js';
import { CARD_COLUMNS } from './properties.js';

/** Favourites and inquiries for the logged-in user. Every query is scoped to req.user. */
export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.get(
  '/favorites',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT ${CARD_COLUMNS}, true AS is_favorite FROM favorites f
       JOIN properties p ON p.id = f.property_id JOIN users u ON u.id = p.owner_id
       WHERE f.user_id = $1 AND p.moderation_status <> 'removed' AND p.status IN ('published','rented','sold')
       ORDER BY f.created_at DESC`,
      [req.user!.id],
    );
    res.json({ items: rows });
  }),
);

accountRouter.put(
  '/favorites/:propertyId',
  ah(async (req, res) => {
    const { propertyId } = req.params;
    if (!isUuid(propertyId)) throw notFound('Listing');
    const { rowCount } = await query(
      `INSERT INTO favorites (user_id, property_id)
       SELECT $1, p.id FROM properties p WHERE p.id = $2 AND p.status = 'published' AND p.moderation_status <> 'removed'
       ON CONFLICT DO NOTHING`,
      [req.user!.id, propertyId],
    );
    if (rowCount === 0) {
      const exists = await query('SELECT 1 FROM favorites WHERE user_id = $1 AND property_id = $2', [req.user!.id, propertyId]);
      if (!exists.rowCount) throw notFound('Listing');
    }
    res.status(204).end();
  }),
);

accountRouter.delete(
  '/favorites/:propertyId',
  ah(async (req, res) => {
    if (isUuid(req.params.propertyId))
      await query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [req.user!.id, req.params.propertyId]);
    res.status(204).end();
  }),
);

accountRouter.get(
  '/inquiries/sent',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT q.id, q.message, q.status, q.created_at, p.id AS property_id, p.title AS property_title,
         p.listing_type, p.city, p.subcity
       FROM inquiries q JOIN properties p ON p.id = q.property_id
       WHERE q.sender_user_id = $1 ORDER BY q.created_at DESC`,
      [req.user!.id],
    );
    res.json({ items: rows });
  }),
);

accountRouter.get(
  '/inquiries/received',
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT q.id, q.name, q.email, q.phone, q.message, q.status, q.created_at,
         p.id AS property_id, p.title AS property_title
       FROM inquiries q JOIN properties p ON p.id = q.property_id
       WHERE p.owner_id = $1 ORDER BY q.created_at DESC`,
      [req.user!.id],
    );
    res.json({ items: rows });
  }),
);

accountRouter.patch(
  '/inquiries/:id',
  ah(async (req, res) => {
    const { status } = inquiryStatusSchema.parse(req.body);
    if (!isUuid(req.params.id)) throw notFound('Inquiry');
    // Only the owner of the listing the inquiry is about can change it
    const { rows } = await query(
      `UPDATE inquiries q SET status = $3 FROM properties p
       WHERE q.id = $1 AND p.id = q.property_id AND p.owner_id = $2 RETURNING q.id, q.status`,
      [req.params.id, req.user!.id, status],
    );
    if (!rows[0]) throw notFound('Inquiry');
    res.json({ inquiry: rows[0] });
  }),
);
