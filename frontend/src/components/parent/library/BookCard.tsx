import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Book } from '@/types/library';

interface BookCardProps {
  book: Book;
  index: number;
  onDelete?: (book: Book) => void;
  onEdit?: (book: Book) => void;
}

export function formatBookName(name: string): string {
  return name.replace(/《|》|【|】/g, '').trim();
}

export function BookCard({
  book,
  index,
}: BookCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleClick = () => {
    navigate(`/parent/library/${book.id}`);
  };

  const progress = book.totalPages > 0 ? Math.min(100, Math.round(((book.totalReadPages || 0) / book.totalPages) * 100)) : 0;
  const isFinished = book.readState?.status === 'finished';
  const isReading = book.readState?.status === 'reading';
  const statusMeta = isFinished
    ? { label: '已读完', className: 'bg-emerald-100 text-emerald-700' }
    : isReading
      ? { label: '在读中', className: 'bg-blue-100 text-blue-700' }
      : { label: '未记录', className: 'bg-slate-100 text-slate-600' };

  const renderCover = () => (
    <div className="relative w-full h-full bg-muted">
      {book.coverUrl && !imageError ? (
        <>
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={book.coverUrl}
            alt={formatBookName(book.name)}
            className={cn(
              "w-full h-full object-contain transition-all duration-300",
              imageLoading ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
            onError={() => setImageError(true)}
            onLoad={() => setImageLoading(false)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <BookOpen className="w-10 h-10 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      className="group relative"
    >
      <Card className={cn(
        'group/card flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
      )}>
        <button type="button" onClick={handleClick} className="flex h-full flex-col text-left">
          <div className="relative rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
            <span className={`absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <div className="mx-auto aspect-[3/4] w-[68%] overflow-hidden rounded-md bg-slate-100 shadow-lg shadow-slate-200">
              {renderCover()}
            </div>
          </div>

          <div className="flex flex-1 flex-col pt-3">
            <div className="min-w-0 flex-1">
              <h4 className="text-base font-semibold leading-6 text-foreground line-clamp-2">
                {formatBookName(book.name)}
              </h4>
              <p className="mt-1 truncate text-sm text-muted-foreground">{book.author || '未知作者'}</p>
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isFinished ? '已读完' : isReading ? `阅读中 · ${progress}%` : '暂无阅读记录'}
                </p>
              </div>
            </div>
          </div>
        </button>
      </Card>
    </motion.div>
  );
}
