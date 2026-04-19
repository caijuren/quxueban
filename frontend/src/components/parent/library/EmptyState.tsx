import { Library, Search, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  hasBooks: boolean;
  onAddByISBN: () => void;
  onImport: () => void;
  onManualAdd: () => void;
  onClearFilters: () => void;
}

export function EmptyState({
  hasBooks,
  onAddByISBN,
  onImport,
  onManualAdd,
  onClearFilters,
}: EmptyStateProps) {
  if (hasBooks) {
    return (
      <Card className="border border-dashed border-border rounded-xl overflow-hidden">
        <CardContent className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground text-lg">没有找到匹配的书籍</h3>
          <p className="text-muted-foreground mt-1">尝试调整筛选条件或搜索关键词</p>
          <Button
            onClick={onClearFilters}
            variant="outline"
            className="mt-4 rounded-lg"
          >
            清除筛选条件
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-dashed border-border rounded-xl overflow-hidden">
      <CardContent className="text-center py-16 bg-gradient-to-b from-muted/50 to-muted">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Library className="w-10 h-10 text-primary" />
          </div>
          <h3 className="font-bold text-foreground text-2xl mb-2">图书馆还是空的</h3>
          <p className="text-muted-foreground mb-8">添加第一本书，开始记录孩子的阅读成长之旅</p>

          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              onClick={onAddByISBN}
              className="rounded-xl bg-primary text-white h-12 px-6"
            >
              <Search className="w-4 h-4 mr-2" />
              ISBN快速添加
            </Button>
            <Button
              onClick={onImport}
              variant="outline"
              className="rounded-xl h-12 px-6"
            >
              <Upload className="w-4 h-4 mr-2" />
              批量导入
            </Button>
            <Button
              onClick={onManualAdd}
              variant="ghost"
              className="rounded-xl h-12 px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              手动录入
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
