"use client";

import { createContext, useContext, useId, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/** Issue fields from the latest summary, and whether to show only sections that need attention. */
interface SectionMode {
  issueFields: (string | null)[];
  onlyIssues: boolean;
}
const SectionModeContext = createContext<SectionMode>({ issueFields: [], onlyIssues: false });
export const SectionModeProvider = SectionModeContext.Provider;
export const useSectionMode = () => useContext(SectionModeContext);

function issueCount(fields: (string | null)[], prefixes: string[]): number {
  return fields.filter((f) => f && prefixes.some((p) => f === p || f.startsWith(`${p}.`))).length;
}

/** Draft path -> document the value was auto-filled from (e.g. "Form 16"). */
const FieldSourcesContext = createContext<Record<string, string>>({});
export const FieldSourcesProvider = FieldSourcesContext.Provider;

/** Red `*` shown next to the label of a required field. */
function RequiredMark() {
  return <span className="text-error">*</span>;
}

/** Label/hint for a field: a red `*` when required, and an "Auto-filled from
 *  Form 16" tag when the value was auto-filled from a document. */
function useFieldMeta(label: string, path: string | undefined, required: boolean | undefined, hint?: string) {
  const sources = useContext(FieldSourcesContext);
  const source = path ? sources[path] : undefined;
  return {
    label: required ? <>{label} <RequiredMark /></> : label,
    hint: source ? `Auto-filled from ${source}${hint ? ` · ${hint}` : ""}` : hint,
  };
}

export function updateAt<T>(list: T[], index: number, patch: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

export function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

// Same ceiling the server enforces (₹1,000 crore).
export const MAX_AMOUNT = 10_000_000_000;

export function AmountInput({
  label,
  value,
  onChange,
  hint,
  disabled,
  path,
  required,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  disabled?: boolean;
  path?: string;
  required?: boolean;
}) {
  const id = useId();
  const meta = useFieldMeta(label, path, required && !disabled, hint);
  return (
    <Input
      id={id}
      type="number"
      min={0}
      max={MAX_AMOUNT}
      inputMode="numeric"
      label={meta.label}
      hint={meta.hint}
      placeholder="0"
      disabled={disabled}
      value={value ? String(value) : ""}
      onChange={(e) => {
        const parsed = Math.floor(Number(e.target.value));
        onChange(Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_AMOUNT) : 0);
      }}
    />
  );
}

export function TextInput({
  label,
  value,
  onChange,
  uppercase,
  type = "text",
  hint,
  placeholder,
  maxLength,
  inputMode,
  path,
  required,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  uppercase?: boolean;
  type?: "text" | "date" | "email" | "tel";
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "numeric" | "text";
  path?: string;
  required?: boolean;
}) {
  const id = useId();
  const meta = useFieldMeta(label, path, required, hint);
  return (
    <Input
      id={id}
      type={type}
      label={meta.label}
      hint={meta.hint}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode}
      className={uppercase ? "uppercase" : undefined}
      value={value ?? ""}
      onChange={(e) => {
        const next = uppercase ? e.target.value.toUpperCase() : e.target.value;
        onChange(next === "" ? null : next);
      }}
    />
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  path,
  required,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly { value: T; label: string }[];
  placeholder?: string;
  path?: string;
  required?: boolean;
}) {
  const id = useId();
  const meta = useFieldMeta(label, path, required);
  return (
    <Select
      id={id}
      label={meta.label}
      hint={meta.hint}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as T))}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-field px-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
    </div>
  );
}

export function YesNo({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-foreground">
        {label}
        {required && <> <RequiredMark /></>}
      </span>
      <div className="inline-flex shrink-0 rounded-full bg-seg p-1" role="radiogroup" aria-label={label}>
        {([true, false] as const).map((option) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
              value === option ? "bg-seg-on text-foreground shadow-sm" : "text-muted",
            )}
          >
            {option ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Notice({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning" | "error";
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md px-4 py-3 text-sm text-foreground",
        variant === "info" && "bg-field",
        variant === "warning" && "bg-warning-bg",
        variant === "error" && "bg-error-bg",
      )}
    >
      {title && (
        <p
          className={cn(
            "mb-1 font-semibold",
            variant === "warning" && "text-warning",
            variant === "error" && "text-error",
          )}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * A collapsible section with a status badge: "Details added" when it has data
 * and nothing missing, or "N to fix" when the summary reports issues under
 * any of its draft-path `prefixes`. In "only issues" mode (the "A few details
 * are missing" screen) sections without issues are hidden.
 */
export function SectionCard({
  title,
  description,
  children,
  className,
  icon: Icon,
  prefixes,
  filled,
  defaultOpen,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  prefixes?: string[];
  filled?: boolean;
  defaultOpen?: boolean;
}) {
  const { issueFields, onlyIssues } = useSectionMode();
  const issues = prefixes ? issueCount(issueFields, prefixes) : 0;
  const [open, setOpen] = useState(defaultOpen ?? (onlyIssues || issues > 0 || !prefixes));
  const contentId = useId();

  if (onlyIssues && issues === 0) return null;
  const isOpen = onlyIssues || open;

  return (
    <Card className={cn("p-0 bg-card border-line", className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-lg p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:p-6"
      >
        {Icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-field text-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-h2">{title}</span>
            {issues > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                <AlertCircle className="h-3.5 w-3.5" /> {issues} to fix
              </span>
            ) : filled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Details added
              </span>
            ) : null}
          </span>
          {description && <span className="mt-1 block text-sm text-muted">{description}</span>}
        </span>
        <ChevronDown
          className={cn("mt-1 h-5 w-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen && (
        <div id={contentId} className="flex flex-col gap-4 px-4 pb-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      )}
    </Card>
  );
}

export function ListSection<T>({
  title,
  hint,
  items,
  onChange,
  createItem,
  renderItem,
  itemLabel,
  addLabel = "Add",
  max,
}: {
  title: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemLabel: string;
  addLabel?: string;
  max?: number;
}) {
  const canAdd = max === undefined || items.length < max;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          {hint && <p className="text-sm text-muted">{hint}</p>}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canAdd}
          onClick={() => onChange([...items, createItem()])}
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-4 text-sm text-muted">
          Nothing added yet.
        </p>
      ) : (
        items.map((item, index) => (
          <div key={index} className="rounded-md border border-line p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted">
                {itemLabel} {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${itemLabel} ${index + 1}`}
                onClick={() => onChange(removeAt(items, index))}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
            {renderItem(item, (patch) => onChange(updateAt(items, index, patch)), index)}
          </div>
        ))
      )}
    </div>
  );
}
