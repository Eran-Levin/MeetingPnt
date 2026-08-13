import { toneFor, type Tone } from '@meetingpnt/shared';

/**
 * The status→meaning map lives in `shared`, so "declined" can't read as a warning here and a
 * danger on mobile. Only the pixels are decided locally.
 */
const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-tone-neutral-bg text-tone-neutral-fg',
  accent: 'bg-tone-accent-bg text-tone-accent-fg',
  success: 'bg-tone-success-bg text-tone-success-fg',
  warning: 'bg-tone-warning-bg text-tone-warning-fg',
  danger: 'bg-tone-danger-bg text-tone-danger-fg',
  info: 'bg-tone-info-bg text-tone-info-fg',
};

export function Badge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TONE_CLASSES[toneFor(status)]} ${className}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
