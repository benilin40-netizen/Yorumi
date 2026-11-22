import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { SERVER_CONFIG } from './config.js';
import { verifySupabaseAccessToken } from './supabaseAdmin.js';

const SESSION_COOKIE_NAME = 'yorumi_admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

interface RateLimitBucket {
  attempts: number;
  resetAt: number;
}

const loginBuckets = new Map<string, RateLimitBucket>();

// Optional one-time runtime claim hash only when ADMIN_PASSWORD env var is unset
let claimedAdminHash: { salt: string; hash: string } | null = null;

function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = sha256Buffer(a);
  const bufB = sha256Buffer(b);
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(SERVER_CONFIG.adminPassword) || claimedAdminHash !== null;
}

export function verifyAdminPassword(candidate: string): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const envPass = SERVER_CONFIG.adminPassword;
  if (envPass) {
    return constantTimeCompare(candidate, envPass);
  }
  if (claimedAdminHash) {
    const derived = crypto.scryptSync(candidate, claimedAdminHash.salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(derived, 'hex'),
      Buffer.from(claimedAdminHash.hash, 'hex')
    );
  }
  return false;
}

export function claimInitialAdminPassword(password: string): boolean {
  if (SERVER_CONFIG.adminPassword || claimedAdminHash !== null) {
    return false;
  }
  if (!password || password.length < 6) {
    return false;
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  claimedAdminHash = { salt, hash };
  return true;
}

export function checkLoginRateLimit(req: Request): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = loginBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS_PER_WINDOW,
      retryAfterSeconds: 0,
    };
  }

  if (bucket.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: MAX_ATTEMPTS_PER_WINDOW - bucket.attempts,
    retryAfterSeconds: 0,
  };
}

export function recordFailedLoginAttempt(req: Request): {
  remaining: number;
  retryAfterSeconds: number;
} {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = loginBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    loginBuckets.set(ip, { attempts: 1, resetAt });
    return {
      remaining: MAX_ATTEMPTS_PER_WINDOW - 1,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    };
  }

  bucket.attempts += 1;
  return {
    remaining: Math.max(0, MAX_ATTEMPTS_PER_WINDOW - bucket.attempts),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function resetLoginAttempts(req: Request): void {
  const ip = getClientIp(req);
  loginBuckets.delete(ip);
}

function signToken(payload: { role: 'admin'; exp: number; nonce: string }): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return false;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const bufA = Buffer.from(sig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length) return false;
  if (!crypto.timingSafeEqual(bufA, bufB)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (parsed?.role !== 'admin') return false;
    if (typeof parsed?.exp !== 'number' || Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  }
  return cookies;
}

function isHttpsRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

export function setAdminSessionCookie(req: Request, res: Response): void {
  const token = signToken({
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
  });
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const secure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
  ];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAdminSessionCookie(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
  ];
  if (secure) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function isAdminAuthenticated(req: Request): boolean {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  return verifyToken(token);
}

export function verifySameOriginMutation(req: Request): boolean {
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
  if (!origin) return true; // non-browser clients (e.g., curl) without Origin
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export async function isSupabaseAdminRequest(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const verified = await verifySupabaseAccessToken(authHeader);
  return verified.isAdmin;
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const cookieAuthed = isAdminAuthenticated(req);
  if (cookieAuthed) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !verifySameOriginMutation(req)) {
      res.status(403).json({ error: 'Invalid request origin' });
      return;
    }
    next();
    return;
  }

  const supabaseAdminAuthed = await isSupabaseAdminRequest(req);
  if (supabaseAdminAuthed) {
    next();
    return;
  }

  res.status(401).json({ error: 'Administrator authentication required' });
}
