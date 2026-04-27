import type { ReactNode } from 'react';
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
    <section className={cn('w-full rounded-lg border border-violet-100 bg-gradient-to-r from-pink-50 via-violet-50 to-indigo-50 p-4 shadow-sm', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto pb-1 scrollbar-hide">
          {left}
        </div>
        {right ? <div className="flex shrink-0 flex-wrap gap-2">{right}</div> : null}
      </div>
    </section>
  );
}
