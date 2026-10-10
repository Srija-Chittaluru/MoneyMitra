import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: string;
  error?: string;
}

export function Select({ label, hint, error, id, className, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "h-11 rounded-md border border-line bg-field px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          error && "border-error",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-link">{hint}</p>
      ) : null}
    </div>
  );
}
