import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { sendVerificationEmail } from '../../lib/resendClient.js';
import { toLocale, toSharedUser } from '../../lib/userName.js';
import { HttpError } from '../../middleware/errorHandler.js';

/**
 * Confirming an email address — asked of exactly one kind of account: a leader who signed up on
 * their own. Everyone else got here through a link that was emailed to them (an invitation), which
 * already proves the address; a leader's sign-up form proves nothing, and a leader's address is
 * where the app sends mail on their behalf and what their members see invitations come from.
 *
 * Until confirmed they can sign in, and that's all: creating a group is refused
 * (`requireVerifiedEmail`), and with no group there is nothing else a leader can do.
 */

const LINK_VALID_FOR = '7d';
/** One email a minute per person — the button is right there, and every send is one of a daily
 * allowance. Held in memory: a restart forgetting it costs one extra email. */
const RESEND_GAP_MS = 60_000;
const lastSentAt = new Map<string, number>();

/**
 * Signed with its own secret, derived from the access-token one: the link travels by email, and
 * with the same secret it would also be accepted as a sign-in token for that account.
 */
const secret = `${env.JWT_ACCESS_SECRET}:verify-email`;

interface VerifyClaims {
  sub: string;
  /** The address the link was sent to. A link for an old address must not confirm a new one. */
  email: string;
}

export const needsVerification = (user: Pick<User, 'role' | 'emailVerifiedAt'>) =>
  user.role === 'leader' && user.emailVerifiedAt === null;

/** Sends (or re-sends) the confirmation link. Throws if the email can't leave. */
export async function sendVerificationLink(user: User) {
  const token = jwt.sign({ sub: user.id, email: user.email } satisfies VerifyClaims, secret, {
    expiresIn: LINK_VALID_FOR,
  } as jwt.SignOptions);
  await sendVerificationEmail({
    to: user.email,
    locale: toLocale(user.locale),
    verifyUrl: `${env.PORTAL_URL}/verify-email?token=${encodeURIComponent(token)}`,
  });
  lastSentAt.set(user.id, Date.now());
}

export async function resendVerificationLink(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, 'user_not_found');
  // Already confirmed (in another tab, say): nothing to send, and not an error.
  if (!needsVerification(user)) return;
  if (Date.now() - (lastSentAt.get(userId) ?? 0) < RESEND_GAP_MS) {
    throw new HttpError(429, 'verification_email_too_soon');
  }
  await sendVerificationLink(user);
}

/** Opening the link. Safe to open twice — the second time it is simply already true. */
export async function verifyEmail(token: string) {
  let claims: VerifyClaims;
  try {
    claims = jwt.verify(token, secret) as VerifyClaims;
  } catch {
    throw new HttpError(400, 'verification_link_invalid');
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || user.email.toLowerCase() !== claims.email.toLowerCase()) {
    throw new HttpError(400, 'verification_link_invalid');
  }
  if (user.emailVerifiedAt) return toSharedUser(user);

  const verified = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  return toSharedUser(verified);
}
