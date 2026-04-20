import { cn } from '@/lib/utils';

export const settingsStyles = {
  card: {
    wrapper: 'border border-border shadow-md rounded-xl overflow-hidden transition-all hover:shadow-lg',
    header: 'pb-4 pt-5 px-5',
    content: 'px-5 pb-5',
  },

  titles: {
    cardTitle: 'text-lg font-semibold text-foreground',
    sectionTitle: 'text-base font-medium text-foreground',
    label: 'text-sm font-medium text-foreground',
    helper: 'text-xs text-muted-foreground',
  },

  input: {
    default: 'h-11 rounded-lg bg-muted/30 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all',
    small: 'h-9 rounded-lg text-sm bg-muted/30 border border-border',
  },

  button: {
    primary: 'h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-sm',
    secondary: 'h-10 rounded-lg bg-white border border-border hover:bg-muted/30 transition-all',
    outline: 'h-10 rounded-lg border border-border hover:bg-muted/20 transition-all',
    compact: 'h-8 rounded-lg',
  },

  section: {
    gap: 'space-y-6',
  },

  grid: {
    cols: 'grid grid-cols-1 md:grid-cols-2 gap-4',
  },
};

// 主题色彩系统
export const themeColors = {
  account: {
    primary: 'bg-green-500',
    secondary: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: 'text-green-500',
  },
  family: {
    primary: 'bg-blue-500',
    secondary: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: 'text-blue-500',
  },
  learning: {
    primary: 'bg-purple-500',
    secondary: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: 'text-purple-500',
  },
  notification: {
    primary: 'bg-orange-500',
    secondary: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-200',
    icon: 'text-orange-500',
  },
  ai: {
    primary: 'bg-purple-600',
    secondary: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-200',
    icon: 'text-purple-600',
  },
  data: {
    primary: 'bg-indigo-500',
    secondary: 'bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: 'text-indigo-500',
  },
  danger: {
    primary: 'bg-red-500',
    secondary: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-500',
  },
};

export function getInputClass(hasError?: boolean): string {
  return cn(
    settingsStyles.input.default,
    hasError && 'border-destructive focus:border-destructive focus:ring-destructive/20'
  );
}

export function getButtonPrimaryClass(isLoading?: boolean, color?: string): string {
  return cn(
    settingsStyles.button.primary,
    color,
    isLoading && 'opacity-70 pointer-events-none'
  );
}

export function getCardHeaderClass(iconColor?: string): string {
  return cn(
    settingsStyles.card.header,
    iconColor && `border-b ${iconColor}/20 border-opacity-30`
  );
}
