import { emailText, isRtlLocale, isolate, type Locale } from '@meetingpnt/shared';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * The one place mail leaves from, and it fails loudly. Two silent failures used to look like
 * success: Resend answers a rejected email with an error value rather than throwing, and with no
 * API key the email was only written to the log — which is right on a laptop and, in production,
 * meant invitations that never left while the portal said "invited".
 */
async function deliver(email: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
  /** What to print instead when there is no API key (development). */
  devNote: string;
}) {
  if (!resend) {
    if (env.NODE_ENV === 'production') {
      console.error('[email] RESEND_API_KEY is not set — nothing can be sent');
      throw new HttpError(502, 'email_send_failed');
    }
    console.log(`[email:dev] To: ${email.to}\nSubject: ${email.subject}\n${email.devNote}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email.to,
    subject: email.subject,
    html: email.html,
    attachments: email.attachments,
  });
  if (error) {
    // The reason goes to the log, not to the person: it names our sender setup, not their mistake.
    console.error(`[email] send failed: ${error.name}: ${error.message}`);
    throw new HttpError(502, 'email_send_failed');
  }
}

interface SendInvitationEmailParams {
  to: string;
  groupName: string;
  /** Null when the inviter's account can't be found — the email then names "a MeetingPnt leader". */
  inviterName: string | null;
  acceptUrl: string;
  /**
   * The inviter's language. The invitee has no account yet, so nothing says what they read; the
   * leader who is inviting them is the best guess, and the app switches to their own preference
   * once they sign up.
   */
  locale: Locale;
}

/** Names come from people; in markup they're text, never tags. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `<bdi>` keeps an English group name from reordering a Hebrew sentence around it. */
export const bdi = (text: string) => `<bdi>${escapeHtml(text)}</bdi>`;

/** The subject and body, in the inviter's language. Split from sending so it can be checked alone. */
export function buildInvitationEmail(params: Omit<SendInvitationEmailParams, 'to'>) {
  const { locale } = params;
  const inviter = params.inviterName ?? emailText(locale, 'inviterFallback');

  const subject = emailText(locale, 'invitationSubject', {
    inviter: isolate(inviter),
    group: isolate(params.groupName),
  });
  // Opening this on a phone is the happy path — MeetingPnt is a phone app — but the link is an
  // ordinary web page, so it still explains itself on a laptop instead of silently doing nothing.
  const html = `
    <div lang="${locale}" dir="${isRtlLocale(locale) ? 'rtl' : 'ltr'}">
      <p>${emailText(locale, 'invitationIntro', {
        inviter: bdi(inviter),
        group: `<strong>${bdi(params.groupName)}</strong>`,
      })}</p>
      <p><a href="${escapeHtml(params.acceptUrl)}">${emailText(locale, 'invitationOpen')}</a> ${emailText(locale, 'invitationPhone')}</p>
      <p>${emailText(locale, 'invitationExpires')}</p>
    </div>
  `;

  return { subject, html };
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { subject, html } = buildInvitationEmail(params);
  await deliver({ to: params.to, subject, html, devNote: `Accept URL: ${params.acceptUrl}` });
}

/** The link a leader who signed up on their own has to open before they can create a group. */
export async function sendVerificationEmail(params: { to: string; verifyUrl: string; locale: Locale }) {
  const { locale } = params;
  const html = `
    <div lang="${locale}" dir="${isRtlLocale(locale) ? 'rtl' : 'ltr'}">
      <p>${emailText(locale, 'verifyIntro')}</p>
      <p><a href="${escapeHtml(params.verifyUrl)}">${emailText(locale, 'verifyOpen')}</a></p>
      <p>${emailText(locale, 'verifyExpires')}</p>
    </div>
  `;
  await deliver({
    to: params.to,
    subject: emailText(locale, 'verifySubject'),
    html,
    devNote: `Verify URL: ${params.verifyUrl}`,
  });
}

/** The bare address mail goes out from — `RESEND_FROM_EMAIL` may be written `Name <address>`. A
 * calendar invitation has to name it as the organiser, or mail apps treat the invitation as forged. */
export const senderAddress = env.RESEND_FROM_EMAIL.match(/<([^>]+)>/)?.[1] ?? env.RESEND_FROM_EMAIL;

interface SendCalendarEmailParams {
  to: string;
  subject: string;
  html: string;
  /** The invitation itself (`buildIcsInvitation`). */
  ics: string;
  method: 'request' | 'cancel';
}

/**
 * An email carrying a calendar invitation. The `method` in the attachment's type is what makes a
 * mail app treat the file as an invitation to act on rather than a file to download.
 */
export async function sendCalendarEmail(params: SendCalendarEmailParams) {
  await deliver({
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: [
      {
        filename: 'invite.ics',
        content: Buffer.from(params.ics, 'utf8'),
        contentType: `text/calendar; charset=utf-8; method=${params.method.toUpperCase()}`,
      },
    ],
    devNote: params.ics,
  });
}
