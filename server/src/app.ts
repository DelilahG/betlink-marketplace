import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { ZodError } from 'zod';
import { loadUser } from './auth.js';
import { config } from './config.js';
import { HttpError } from './lib/http.js';
import { authLimiter } from './lib/limits.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { propertiesRouter } from './routes/properties.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          // Plain-http localhost would break if requests were forced to https
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CSRF defence: session cookies are SameSite=Lax, and every state-changing API call must carry a
  // custom header. Browsers cannot attach custom headers cross-site without a CORS preflight we never grant.
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Requested-With') !== 'BetLink')
      return next(new HttpError(403, 'Missing request header'));
    next();
  });
  app.use('/api', loadUser);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/properties', propertiesRouter);
  app.use('/api/me', accountRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));

  // Uploaded images: random names, no directory listing, no dotfiles, never sniffed as HTML/script.
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
      },
    }),
  );

  // In production the API also serves the built React app
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false }));
    app.get('*', (req, res, next) =>
      req.path.startsWith('/uploads') ? next() : res.sendFile(path.join(config.clientDist, 'index.html')),
    );
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
      return res.status(400).json({ error: 'Please check the highlighted fields', fields });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller' : 'Upload rejected: ' + err.message;
      return res.status(400).json({ error: msg });
    }
    if ((err as { type?: string })?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });
  return app;
}
