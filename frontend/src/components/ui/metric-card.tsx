import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'teal';
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
  className?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const colorMap = {
  blue: 'bg-blue-100 text-blue-600 border-blue-200',
  green: 'bg-green-100 text-green-600 border-green-200',
  purple: 'bg-purple-100 text-purple-600 border-purple-200',
  orange: 'bg-orange-100 text-orange-600 border-orange-200',
  red: 'bg-red-100 text-red-600 border-red-200',
  teal: 'bg-teal-100 text-teal-600 border-teal-200',
};

export function MetricCard({ title, value, subtext, icon: Icon, color, trend, change, className, onClick, isLoading }: MetricCardProps) {
  return (
    <Card 
      className={cn(
        "border border-border shadow-sm rounded-lg hover:shadow-md transition-all duration-300",
        onClick && "cursor-pointer hover:border-primary/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn('size-9 rounded-lg flex items-center justify-center', colorMap[color])}>
              <Icon className="size-[18px]" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">{title}</p>
              {isLoading ? (
                <Skeleton className="h-3 w-20 mt-1" />
              ) : subtext ? (
                <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            {!isLoading && trend && change && (
              <div className={cn(
                'text-xs font-medium px-2 py-1 rounded-full inline-block mt-1',
                trend === 'up' ? 'bg-green-100 text-green-600' :
                trend === 'down' ? 'bg-red-100 text-red-600' :
                'bg-gray-100 text-gray-600'
              )}>
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {change}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
