import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

// Rate limits blunt brute-force logins and inquiry/report spam. Disabled under automated tests.
const make = (windowMinutes: number, limit: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: message },
  });

export const authLimiter = make(15, 20, 'Too many attempts. Please wait a few minutes and try again.');
export const inquiryLimiter = make(60, 10, 'You have sent many inquiries recently. Please try again later.');
export const reportLimiter = make(60, 10, 'Too many reports from this connection. Please try again later.');
export const uploadLimiter = make(15, 30, 'Too many uploads. Please try again shortly.');
