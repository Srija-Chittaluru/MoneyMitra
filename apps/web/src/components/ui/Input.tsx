import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "h-11 rounded-md border border-line bg-field px-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          error && "border-error",
          className,
        )}
        {...props}
      />
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-link">{hint}</p>
      ) : null}
    </div>
  );
}
