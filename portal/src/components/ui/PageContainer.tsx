import type { ReactNode } from 'react';

export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-3xl px-6 py-8 ${className}`}>{children}</div>;
}
