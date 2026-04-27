import { CalendarDays, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DatePickerProps = {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
};

function parseDate(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatValue(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function DatePicker({ value, onChange, placeholder = '选择日期', className, align = 'end' }: DatePickerProps) {
  const selectedDate = parseDate(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 hover:shadow',
            !selectedDate && 'text-slate-500',
            className
          )}
        >
          <CalendarDays className="size-4 text-primary" />
          <span>{selectedDate ? format(selectedDate, 'yyyy年M月d日', { locale: zhCN }) : placeholder}</span>
          <ChevronDown className="ml-auto size-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto rounded-lg border border-border p-0 shadow-md" align={align}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) onChange(formatValue(date));
          }}
          className="rounded-lg p-3"
          classNames={{
            day_selected: 'rounded-lg bg-primary text-white hover:bg-primary/90',
            day_today: 'rounded-lg bg-primary/10 font-bold text-primary',
            nav_button: 'h-8 w-8 rounded-lg hover:bg-muted',
            caption: 'relative flex w-full items-center justify-center pt-1',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
