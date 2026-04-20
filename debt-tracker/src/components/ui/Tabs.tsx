import { cn } from "@/lib/utils";
import { useState } from "react";

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, children, className }: TabsProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={cn("w-full", className)}>
      {children}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={cn("flex gap-1 bg-gray-100 p-1 rounded-lg", className)}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function TabsTrigger({ value, children, className, isActive, onClick }: TabsTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-200",
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

export function TabsContent({ value, children, className, isActive }: TabsContentProps) {
  if (!isActive) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}
