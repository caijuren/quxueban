import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageToolbar({
  left,
  right,
  className,
}: {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-1 scrollbar-hide">
          {left}
        </div>
        {right ? <div className="flex shrink-0 flex-wrap gap-2">{right}</div> : null}
      </div>
    </section>
  );
}

export function PageToolbarTitle({
  icon: Icon,
  title,
  description,
  badge,
  className,
}: {
  icon: ElementType;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-base font-semibold text-slate-950">{title}</h1>
          {badge}
        </div>
        {description ? (
          <p className="truncate text-xs text-slate-500 sm:text-sm">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FilterBar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white p-3 shadow-sm', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 scrollbar-hide">{children}</div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ElementType;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-dashed border-slate-200 bg-white px-6 py-14 text-center', className)}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
