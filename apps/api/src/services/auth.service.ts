/**
 * Auth Service
 * Handles user registration, login, JWT issuance, and token refresh.
 *
 * SECURITY:
 * - Passwords hashed with bcrypt cost factor 12 (REQUIREMENTS.md security table)
 * - Never return password_hash in any response
 * - JWT access tokens: 24h expiry
 * - Refresh tokens: 30d expiry, stored httpOnly cookie (web) or response body (mobile)
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@ghoast/db';
import { logger } from '../lib/logger.js';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '30d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  email: string;
  tier: string;
  creditBalance: number;
  createdAt: Date;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET environment variable is required');
  return secret;
}

export function issueTokens(userId: string): AuthTokens {
  const accessToken = jwt.sign({ sub: userId, type: 'access' }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ sub: userId, type: 'refresh' }, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): { sub: string } {
  const payload = jwt.verify(token, getJwtSecret()) as { sub: string; type: string };
  if (payload.type !== 'access') throw new Error('Invalid token type');
  return { sub: payload.sub };
}

export function verifyRefreshToken(token: string): { sub: string } {
  const payload = jwt.verify(token, getRefreshSecret()) as { sub: string; type: string };
  if (payload.type !== 'refresh') throw new Error('Invalid token type');
  return { sub: payload.sub };
}

function stripSensitiveFields(user: { id: string; email: string; tier: string; creditBalance: number; createdAt: Date }): SafeUser {
  return {
    id: user.id,
    email: user.email,
    tier: user.tier,
    creditBalance: user.creditBalance,
    createdAt: user.createdAt,
  };
}

// ── Register ─────────────────────────────────────────────────────────────────

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('An account with this email address already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export async function register(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new EmailAlreadyExistsError();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      tier: true,
      creditBalance: true,
      createdAt: true,
    },
  });

  logger.info({ userId: user.id }, 'User registered');

  const tokens = issueTokens(user.id);
  return { user: stripSensitiveFields(user), tokens };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export async function login(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      tier: true,
      creditBalance: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  // Constant-time comparison — always run bcrypt even if user not found
  const hash = user?.passwordHash ?? '$2b$12$invalidhashtopreventtimingattacks00000000000';
  const isValid = await bcrypt.compare(password, hash);

  if (!user || !isValid) throw new InvalidCredentialsError();

  logger.info({ userId: user.id }, 'User logged in');

  const tokens = issueTokens(user.id);
  return { user: stripSensitiveFields(user), tokens };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refresh(refreshToken: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const { sub: userId } = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      tier: true,
      creditBalance: true,
      createdAt: true,
    },
  });

  if (!user) throw new InvalidCredentialsError();

  const tokens = issueTokens(user.id);
  return { user: stripSensitiveFields(user), tokens };
}
