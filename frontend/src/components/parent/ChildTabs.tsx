import { useSelectedChild } from '@/contexts/SelectedChildContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function ChildTabs() {
  const { children, selectedChildId, selectChild, isLoading } = useSelectedChild();
  const navigate = useNavigate();
  const location = useLocation();

  // 只有一个孩子时不显示切换器
  if (children.length <= 1) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-20 h-8 rounded-full bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const handleChildSelect = (childId: number) => {
    selectChild(childId);
    // 更新URL参数，支持链接直享
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('child', children.find(c => c.id === childId)?.name || '');
    navigate({
      pathname: location.pathname,
      search: searchParams.toString()
    }, { replace: true });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {children.map((child) => {
        const isSelected = selectedChildId === child.id;
        return (
          <button
            key={child.id}
            onClick={() => handleChildSelect(child.id)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium transition-all duration-200 whitespace-nowrap relative",
              isSelected
                ? "text-primary font-medium"
                : "text-foreground hover:text-primary"
            )}
          >
            {child.name}
            {isSelected && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
