import { Resend } from 'resend';
import { env } from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendInvitationEmailParams {
  to: string;
  groupName: string;
  inviterName: string;
  acceptUrl: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const subject = `${params.inviterName} invited you to join "${params.groupName}" on MeetingPnt`;
  const html = `
    <p>${params.inviterName} invited you to join <strong>${params.groupName}</strong> on MeetingPnt.</p>
    <p><a href="${params.acceptUrl}">Accept the invitation</a> to create your account and join the group.</p>
    <p>This link expires in 7 days.</p>
  `;

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
