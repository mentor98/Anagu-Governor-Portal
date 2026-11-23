import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { GovernorProfile } from '../src/lib/types.ts';
import { getStaffAccountById } from './supabase.ts';

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export interface GovernorTokenPayload {
  sub: string;
  staff_id: string;
  role: 'governor';
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  governor?: GovernorProfile;
  tokenPayload?: GovernorTokenPayload;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

function decodeDigest(raw: string): Buffer | null {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const buf = Buffer.from(raw, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export function verifyScryptPasscode(
  passcode: string,
  storedHash: string | null | undefined
): boolean {
  if (!passcode || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const trimmed = storedHash.trim();

  // Format A: $scrypt$N$r$p$salt$hash or scrypt:N:r:p:salt:hash
  if (trimmed.startsWith('$scrypt$') || trimmed.startsWith('scrypt:')) {
    const parts = trimmed.startsWith('$scrypt$')
      ? trimmed.slice(8).split('$')
      : trimmed.slice(7).split(':');
    if (parts.length === 5) {
      const N = Number(parts[0]);
      const r = Number(parts[1]);
      const p = Number(parts[2]);
      const salt = parts[3];
      const expectedBuf = decodeDigest(parts[4]);
      if (
        !expectedBuf ||
        !Number.isFinite(N) ||
        !Number.isFinite(r) ||
        !Number.isFinite(p)
      ) {
        return false;
      }
      try {
        const derived = crypto.scryptSync(passcode, salt, expectedBuf.length, {
          N,
          r,
          p,
          maxmem: 128 * 1024 * 1024,
        });
        return (
          derived.length === expectedBuf.length &&
          crypto.timingSafeEqual(derived, expectedBuf)
        );
      } catch {
        return false;
      }
    }
  }

  // Format B: salt:hash or salt$hash
  const separator = trimmed.includes(':')
    ? ':'
    : trimmed.includes('$')
      ? '$'
      : null;

  if (!separator) {
    return false;
  }

  const splitIndex = trimmed.indexOf(separator);
  const saltPart = trimmed.slice(0, splitIndex);
  const hashPart = trimmed.slice(splitIndex + 1);
  if (!saltPart || !hashPart) {
    return false;
  }

  const expectedBuf = decodeDigest(hashPart);
  if (!expectedBuf) {
    return false;
  }

  try {
    const derivedFromStrSalt = crypto.scryptSync(
      passcode,
      saltPart,
      expectedBuf.length,
      { maxmem: 64 * 1024 * 1024 }
    );
    if (
      derivedFromStrSalt.length === expectedBuf.length &&
      crypto.timingSafeEqual(derivedFromStrSalt, expectedBuf)
    ) {
      return true;
    }

    if (/^[0-9a-fA-F]+$/.test(saltPart) && saltPart.length % 2 === 0) {
      const saltBuf = Buffer.from(saltPart, 'hex');
      const derivedFromHexSalt = crypto.scryptSync(
        passcode,
        saltBuf,
        expectedBuf.length,
        { maxmem: 64 * 1024 * 1024 }
      );
      return (
        derivedFromHexSalt.length === expectedBuf.length &&
        crypto.timingSafeEqual(derivedFromHexSalt, expectedBuf)
      );
    }
  } catch {
    return false;
  }

  return false;
}

export function signGovernorToken(staff: GovernorProfile): {
  token: string;
  expiresAt: string;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: GovernorTokenPayload = {
    sub: staff.id,
    staff_id: staff.staff_id,
    role: 'governor',
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest();
  const sigB64 = base64UrlEncode(sig);

  return {
    token: `${payloadB64}.${sigB64}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyGovernorToken(
  token: string
): GovernorTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest();
  const receivedSig = base64UrlDecode(sigB64);

  if (
    expectedSig.length !== receivedSig.length ||
    !crypto.timingSafeEqual(expectedSig, receivedSig)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      base64UrlDecode(payloadB64).toString('utf8')
    ) as GovernorTokenPayload;
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      !parsed.sub ||
      !parsed.staff_id ||
      parsed.role !== 'governor' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= nowSec
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function requireGovernor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Governor authentication required.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyGovernorToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired Governor session token.' });
    return;
  }

  try {
    const staff = await getStaffAccountById(payload.staff_id);
    if (!staff || staff.role !== 'governor' || staff.is_active !== true) {
      res.status(403).json({
        error: 'Governor privileges suspended or revoked.',
      });
      return;
    }

    req.governor = {
      id: String(staff.id),
      staff_id: String(staff.staff_id),
      role: String(staff.role),
      full_name: String(staff.full_name || staff.name || staff.staff_id),
      email: staff.email ? String(staff.email) : null,
      jurisdiction: staff.jurisdiction ? String(staff.jurisdiction) : null,
      state_name: staff.state_name ? String(staff.state_name) : null,
      lga_name: staff.lga_name ? String(staff.lga_name) : null,
      wallet_address: staff.wallet_address ? String(staff.wallet_address) : null,
      is_active: Boolean(staff.is_active),
      last_login_at: staff.last_login_at ? String(staff.last_login_at) : null,
    };
    req.tokenPayload = payload;
    next();
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unable to verify Governor session.';
    res.status(503).json({ error: msg });
  }
}
