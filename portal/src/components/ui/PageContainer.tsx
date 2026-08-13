import type { ReactNode } from 'react';

/**
 * `wide` is for the planning screens — a roster and a schedule sitting side by side is the whole
 * point of doing this on a web browser rather than a phone. Reading-width pages (login, a single
 * activity) stay narrow.
 */
export function PageContainer({
  children,
  wide = false,
  className = '',
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-3xl'} px-6 py-8 ${className}`}>
      {children}
    </div>
  );
}
