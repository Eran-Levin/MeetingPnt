const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-amber-100 text-amber-700',
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
  admin: 'bg-purple-100 text-purple-700',
  leader: 'bg-blue-100 text-blue-700',
  user: 'bg-slate-100 text-slate-600',
};

export function Badge({ status, className = '' }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600';
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style} ${className}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
