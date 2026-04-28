import { toast } from 'sonner';

export function showCopyableError(message: string) {
  toast.error(message, {
    duration: 10000,
    action: {
      label: '复制',
      onClick: () => {
        void navigator.clipboard?.writeText(message);
      },
    },
  });
}

