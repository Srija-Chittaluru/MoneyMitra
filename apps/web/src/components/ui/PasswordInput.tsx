"use client";

import { useId, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  hint?: string;
  /** Optional leading icon, e.g. for auth-screen fields (`<Lock className="h-4 w-4" />`). */
  icon?: ReactNode;
}

export function PasswordInput({ label, hint, icon, id, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{icon}</span>
        )}
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "h-11 w-full rounded-md border border-line bg-field px-3 pr-11 text-base text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
            !!icon && "pl-11",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
        </button>
      </div>
      {hint && <p className="text-sm text-link">{hint}</p>}
    </div>
  );
}
