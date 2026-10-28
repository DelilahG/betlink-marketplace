import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';
import { query } from './db.js';
import { HttpError } from './lib/http.js';

export type Role = 'user' | 'owner' | 'agent' | 'admin';
export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  verification_status: string;
  created_at: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const SESSION_COOKIE = 'betlink_sid';
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export const USER_COLUMNS = 'u.id, u.email, u.full_name, u.phone, u.role, u.verification_status, u.created_at';

/** Creates a DB-backed session; only the SHA-256 of the token is stored, so a DB leak does not leak live sessions. */
export async function createSession(res: Response, userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expires,
  ]);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.isProd, expires, path: '/' });
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length < 100) {
      const { rows } = await query<SessionUser>(
        `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now() AND NOT u.is_suspended`,
        [hashToken(token)],
      );
      req.user = rows[0];
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please log in to continue'));
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please log in to continue'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Your account type cannot perform this action'));
    next();
  };
