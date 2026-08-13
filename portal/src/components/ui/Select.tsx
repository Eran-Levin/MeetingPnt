import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className = '', id, children, ...props }: Props) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <select
        id={id}
        className={`rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-normal text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
