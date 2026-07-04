import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MasonryGridProps {
  children: ReactNode;
  className?: string;
}

export default function MasonryGrid({ children, className }: MasonryGridProps) {
  return (
    <div className={cn("columns-1 gap-4 sm:columns-2 md:columns-3 lg:columns-4", className)}>
      {children}
    </div>
  );
}

export function MasonryItem({ children, className }: MasonryGridProps) {
  return <div className={cn("mb-4 break-inside-avoid", className)}>{children}</div>;
}
