import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from '../src/db/index.js';
import { users, sessions, emailVerificationTokens, passwordResetTokens, adminAuditLogs } from '../src/db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { sendVerificationEmail, sendPasswordResetEmail } from '../src/services/emailService.js';

const BOOTSTRAP_ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || 'benilin40@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
  sessionId?: string;
}

// Helper to hash opaque session tokens
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check cookie or Authorization header
  let rawToken = req.cookies?.yorumi_session;
  if (!rawToken) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    }
  }

  if (!rawToken) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.',
    });
  }

  const tokenHash = hashToken(rawToken);
  const now = Date.now();

  try {
    const sessionRecord = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, now)),
    });

    if (!sessionRecord) {
      return res.status(401).json({
        success: false,
        error: 'Session expired or invalid. Please sign in again.',
      });
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, sessionRecord.userId),
    });

    if (!userRecord || userRecord.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Account not found or suspended.',
      });
    }

    // Check if bootstrap admin email should dynamically grant admin role
    let role = userRecord.role;
    if (userRecord.emailVerified && BOOTSTRAP_ADMIN_EMAILS.has(userRecord.email.toLowerCase())) {
      role = 'admin';
    }

    req.authUser = {
      id: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayName,
      email: userRecord.email,
      role: role as any,
      status: userRecord.status as any,
      emailVerified: userRecord.emailVerified,
      avatarUrl: userRecord.avatarUrl,
      bio: userRecord.bio,
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
    };
    req.sessionId = tokenHash;

    return next();
  } catch (err: any) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal authentication error.',
    });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }
  if (req.authUser.role !== 'admin' || !req.authUser.emailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Verified administrator privileges required.',
    });
  }
  return next();
}

export async function logAdminAction(adminUserId: string, action: string, targetType: string, targetId?: string, details?: string, ipAddress?: string) {
  try {
    await db.insert(adminAuditLogs).values({
      adminUserId,
      action,
      targetType,
      targetId: targetId || null,
      details: details || null,
      ipAddress: ipAddress || null,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}
