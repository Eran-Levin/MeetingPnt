import { useEffect, useState } from 'react';

/** Two letters at most — "Ana María Ruiz" reads as AR, not AMR. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

/**
 * A face where there is one, initials where there isn't — never an anonymous silhouette, because a
 * list of identical grey heads tells a leader nothing. The same rule as the phone app's avatar.
 * A photo that won't load falls back to initials too.
 *
 * Decorative: the person's name is always written next to it, so it has no alt text of its own.
 */
export function Avatar({
  name,
  uri,
  size = 32,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  const box = { width: size, height: size };

  if (uri && !failed) {
    return (
      <img
        src={uri}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={box}
        className="shrink-0 rounded-full bg-surface-raised object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: Math.round(size * 0.4) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-raised font-medium text-ink-secondary"
    >
      {initialsOf(name)}
    </span>
  );
}
