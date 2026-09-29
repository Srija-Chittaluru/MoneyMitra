import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardDark({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("dark rounded-lg bg-background p-6 text-foreground", className)}
      {...props}
    />
  );
}
