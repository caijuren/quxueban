import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ClipboardList, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Todo {
  id: string;
  title: string;
  childName: string;
  category: string;
  duration: string;
  completed: boolean;
}

interface TodayTodosProps {
  todos: Todo[];
  title?: string;
  onComplete?: (todoId: string) => void;
  onEmptyAction?: () => void;
}

const categoryColorMap: Record<string, string> = {
  '中文阅读': 'bg-pink-50 text-pink-600',
  '英语阅读': 'bg-purple-50 text-purple-600',
  '校内巩固': 'bg-blue-50 text-blue-600',
  '校内拔高': 'bg-blue-50 text-blue-600',
  '课外课程': 'bg-orange-50 text-orange-600',
  '体育运动': 'bg-green-50 text-green-600',
};

function getCategoryColor(category: string): string {
  return categoryColorMap[category] || 'bg-gray-50 text-gray-600';
}

export function TodayTodos({ todos, title = '今日待办', onComplete, onEmptyAction }: TodayTodosProps) {
  const completedTodos = todos.filter(todo => todo.completed);
  const pendingTodos = todos.filter(todo => !todo.completed);

  return (
    <Card className="border border-border shadow-sm rounded-lg h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-base font-semibold text-foreground">
          {title}
        </CardTitle>
        <span className="text-xs font-medium text-muted-foreground">
          {completedTodos.length}/{todos.length} 已完成
        </span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {todos.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <ClipboardList className="size-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">暂无今日待办</p>
            {onEmptyAction && (
              <Button variant="outline" size="sm" onClick={onEmptyAction}>
                去看看任务
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {pendingTodos.map((todo, index) => (
              <motion.div
                key={todo.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <button
                  onClick={() => onComplete?.(todo.id)}
                  className="flex-shrink-0"
                >
                  <Circle className="size-5 text-muted-foreground hover:text-primary transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground text-sm">
                      {todo.title}
                    </h4>
                    <Badge className={cn(
                      'text-xs px-2 py-0.5 rounded-full border-0',
                      getCategoryColor(todo.category)
                    )}>
                      {todo.category}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{todo.childName}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <Clock className="size-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{todo.duration}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {completedTodos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">已完成</h4>
                {completedTodos.map((todo, index) => (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: pendingTodos.length * 0.05 + index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="size-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-muted-foreground text-sm line-through">
                        {todo.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{todo.childName}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <Clock className="size-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{todo.duration}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
