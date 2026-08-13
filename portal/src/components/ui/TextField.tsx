import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

const FIELD_CLASSES =
  'rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-normal text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-surface-sunken disabled:text-ink-muted';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextField({ label, className = '', id, ...props }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <input id={id} className={`${FIELD_CLASSES} ${className}`} {...props} />
    </label>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className = '', id, ...props }: TextAreaProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <textarea id={id} className={`${FIELD_CLASSES} ${className}`} {...props} />
    </label>
  );
}
