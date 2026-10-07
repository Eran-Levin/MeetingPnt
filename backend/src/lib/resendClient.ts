import { emailText, isRtlLocale, isolate, type Locale } from '@meetingpnt/shared';
import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

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
const bdi = (text: string) => `<bdi>${escapeHtml(text)}</bdi>`;

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

  if (!resend) {
    // No RESEND_API_KEY configured: log instead of sending, so the invite flow is testable in dev.
    console.log(`[email:dev] To: ${params.to}\nSubject: ${subject}\nAccept URL: ${params.acceptUrl}`);
    return;
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject,
    html,
  });
}
