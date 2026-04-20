import { useSelectedChild } from '@/contexts/SelectedChildContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChildSwitcherProps {
  className?: string;
}

export function ChildSwitcher({ className }: ChildSwitcherProps) {
  const { children, selectedChild, selectedChildId, selectChild, isLoading } = useSelectedChild();

  // 只有一个孩子时不显示切换器
  if (children.length <= 1) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", className)}>
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200",
          "hover:bg-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500/20",
          className
        )}
      >
        {selectedChild ? (
          <>
            <Avatar className="w-8 h-8 ring-2 ring-white shadow-sm">
              <AvatarImage src={selectedChild.avatar} />
              <AvatarFallback className="bg-primary text-white text-xs font-medium">
                {selectedChild.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm text-gray-700 hidden sm:inline">
              {selectedChild.name}
            </span>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-gray-500" />
            </div>
            <span className="font-medium text-sm text-gray-700 hidden sm:inline">
              选择孩子
            </span>
          </>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-100">
          切换查看的孩子
        </div>
        {children.map((child) => (
          <DropdownMenuItem
            key={child.id}
            onClick={() => selectChild(child.id)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
              selectedChildId === child.id && "bg-purple-50"
            )}
          >
            <Avatar className="w-7 h-7">
              <AvatarImage src={child.avatar} />
              <AvatarFallback className="bg-primary text-white text-xs">
                {child.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-sm",
              selectedChildId === child.id ? "font-medium text-gray-900" : "text-gray-700"
            )}>
              {child.name}
            </span>
            {selectedChildId === child.id && (
              <div className="ml-auto w-2 h-2 rounded-full bg-purple-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
