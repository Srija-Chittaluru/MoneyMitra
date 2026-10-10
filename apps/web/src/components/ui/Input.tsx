import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: string;
  error?: string;
  /** Optional leading icon, e.g. for auth-screen fields (`<Mail className="h-4 w-4" />`). */
  icon?: ReactNode;
}

export function Input({ label, hint, error, icon, id, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{icon}</span>
        )}
        <input
          id={id}
          className={cn(
            "h-11 w-full rounded-md border border-line bg-field px-3 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            !!icon && "pl-11",
            error && "border-error",
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-link">{hint}</p>
      ) : null}
    </div>
  );
}
