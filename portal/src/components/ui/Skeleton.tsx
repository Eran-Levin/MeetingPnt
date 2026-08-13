import type { ReactNode } from 'react';

/**
 * A placeholder shaped like the content that's coming. It replaces `Loading…`, which told the
 * leader nothing and made every page jump as it filled in.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-surface-raised ${className}`}
      style={{ animation: 'shimmer 1.4s ease-in-out infinite' }}
      aria-hidden="true"
    />
  );
}

/** Stand-in for a list of cards or rows, at roughly the height of the real thing. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * An invitation, not an apology — names the space and says what would fill it. Most of these
 * screens are empty on the day a leader signs up, and that's the first thing they see.
 */
export function EmptyState({
  headline,
  body,
  action,
}: {
  headline: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium text-ink">{headline}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
