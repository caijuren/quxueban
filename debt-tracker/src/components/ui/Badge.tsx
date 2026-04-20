import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-blue-100 text-blue-800": variant === "default",
          "bg-gray-100 text-gray-800": variant === "secondary",
          "border border-gray-300": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
