import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createSession, destroySession, requireAuth, USER_COLUMNS } from '../auth.js';
import { query } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { loginSchema, profileSchema, registerSchema } from '../validation.js';

export const authRouter = Router();

// Constant work factor for real and dummy comparisons so login timing does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

authRouter.post(
  '/register',
  ah(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, role) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING RETURNING id`,
      [input.email, hash, input.full_name, input.phone, input.role],
    );
    if (!rows[0]) throw new HttpError(409, 'An account with this email already exists');
    await createSession(res, rows[0].id);
    const user = (await query(`SELECT ${USER_COLUMNS} FROM users u WHERE id = $1`, [rows[0].id])).rows[0];
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  ah(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await query(
      `SELECT ${USER_COLUMNS}, u.password_hash, u.is_suspended FROM users u WHERE lower(u.email) = $1`,
      [email],
    );
    const row = rows[0];
    const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, 'Incorrect email or password');
    if (row.is_suspended) throw new HttpError(403, 'This account has been suspended');
    const { password_hash: _h, is_suspended: _s, ...user } = row;
    await createSession(res, user.id);
    res.json({ user });
  }),
);

authRouter.post(
  '/logout',
  ah(async (req, res) => {
    await destroySession(req, res);
    res.status(204).end();
  }),
);

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const input = profileSchema.parse(req.body);
    const me = req.user!;
    // Admins keep their role; others may switch between user/owner/agent (self-declared, never "verified")
    const role = me.role === 'admin' ? 'admin' : (input.role ?? me.role);
    const { rows } = await query(
      `UPDATE users u SET
         full_name = COALESCE($2, full_name),
         phone = CASE WHEN $3::boolean THEN $4 ELSE phone END,
         role = $5,
         verification_status = CASE WHEN $6::boolean AND verification_status IN ('unverified','rejected')
                                    THEN 'pending' ELSE verification_status END,
         updated_at = now()
       WHERE id = $1 RETURNING ${USER_COLUMNS}`,
      [me.id, input.full_name ?? null, 'phone' in req.body, input.phone, role, !!input.request_verification],
    );
    res.json({ user: rows[0] });
  }),
);
