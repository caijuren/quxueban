import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FadeIn, Stagger, HoverLift } from '@/components/MotionPrimitives';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Book {
  id: number;
  title: string;
  author: string;
  cover: string;
  totalPages: number;
  readPages: number;
  category: string;
}

interface ReadingLog {
  pages: number;
  notes: string;
}

export default function Library() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [logPages, setLogPages] = useState('');
  const [logNotes, setLogNotes] = useState('');

  const { data: books = [], isLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const response = await apiClient.get<Book[]>('/books');
      return response.data;
    },
  });

  const addReadingLogMutation = useMutation({
    mutationFn: async ({ bookId, data }: { bookId: number; data: ReadingLog }) => {
      await apiClient.post(`/books/${bookId}/read-log`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setSelectedBook(null);
      setLogPages('');
      setLogNotes('');
      toast.success('阅读记录已添加~');
    },
    onError: () => {
      toast.error('添加失败，请重试');
    },
  });

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddLog = () => {
    if (!selectedBook || !logPages) return;
    const pages = parseInt(logPages, 10);
    if (isNaN(pages) || pages <= 0) {
      toast.error('请输入有效的页数');
      return;
    }
    addReadingLogMutation.mutate({
      bookId: selectedBook.id,
      data: { pages, notes: logNotes },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          📚
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="text-center">
          <h1 className="text-2xl font-bold">我的图书馆</h1>
          <p className="text-muted-foreground mt-1">阅读让世界更精彩~</p>
        </div>
      </FadeIn>

      {/* Search Bar */}
      <FadeIn delay={0.1}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索书籍..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl h-11"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </FadeIn>

      {/* Book Grid */}
      <Stagger stagger={0.08} className="grid grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredBooks.map((book) => {
            const progress = (book.readPages / book.totalPages) * 100;
            return (
              <HoverLift key={book.id}>
                <Card
                  className="rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedBook(book)}
                >
                  <CardContent className="p-0">
                    {/* Book Cover */}
                    <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center relative">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-5xl">📖</span>
                      )}
                      {/* Progress Overlay */}
                      {progress > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs font-medium mb-1">
                            {book.readPages} / {book.totalPages} 页
                          </p>
                          <Progress
                            value={progress}
                            className="h-1.5 bg-white/30"
                          />
                        </div>
                      )}
                      {progress >= 100 && (
                        <div className="absolute top-2 right-2 bg-success text-success-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                          已读完
                        </div>
                      )}
                    </div>
                    {/* Book Info */}
                    <div className="p-3">
                      <h3 className="font-semibold text-sm truncate">{book.title}</h3>
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                    </div>
                  </CardContent>
                </Card>
              </HoverLift>
            );
          })}
        </AnimatePresence>
      </Stagger>

      {/* Empty State */}
      {filteredBooks.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <span className="text-6xl">📚</span>
          <h3 className="text-xl font-semibold mt-4">
            {searchQuery ? '没有找到书籍' : '图书馆是空的'}
          </h3>
          <p className="text-muted-foreground mt-2">
            {searchQuery ? '试试其他关键词吧~' : '等待爸爸妈妈添加书籍~'}
          </p>
        </motion.div>
      )}

      {/* Add Reading Log Dialog */}
      <Dialog open={!!selectedBook} onOpenChange={(open) => !open && setSelectedBook(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">添加阅读记录</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              {/* Book Preview */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-xl">
                <div className="w-12 h-16 bg-primary/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📖</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{selectedBook.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    已读 {selectedBook.readPages} / {selectedBook.totalPages} 页
                  </p>
                </div>
              </div>

              {/* Pages Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">今天读了多少页？</label>
                <Input
                  type="number"
                  placeholder="输入页数"
                  value={logPages}
                  onChange={(e) => setLogPages(e.target.value)}
                  className="rounded-xl h-11"
                  min={1}
                  max={selectedBook.totalPages - selectedBook.readPages}
                />
              </div>

              {/* Notes Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">读后感想（可选）</label>
                <Input
                  placeholder="有什么感想吗？"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setSelectedBook(null)}
            >
              取消
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleAddLog}
              disabled={!logPages || addReadingLogMutation.isPending}
            >
              {addReadingLogMutation.isPending ? '添加中...' : '添加记录'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
