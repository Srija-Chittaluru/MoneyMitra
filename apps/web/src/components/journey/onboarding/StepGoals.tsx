"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface GoalChip {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export interface CustomGoal {
  id: string;
  title: string;
  onRemove: () => void;
}

/** Multi-select goal-type chips, plus a free-text box for anything not on the preset list. */
export function StepGoals({
  chips,
  customs,
  onAddCustom,
}: {
  chips: GoalChip[];
  customs: CustomGoal[];
  onAddCustom: (text: string) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddCustom(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className={cn(
              "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              c.selected
                ? "border-[#3155E0] bg-[#3155E0]/10 text-foreground dark:border-[#7B9AFF] dark:bg-[#7B9AFF]/10"
                : "border-line bg-field text-foreground hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-field p-4">
        <p className="text-sm font-medium text-foreground">Something else?</p>
        <div className="flex flex-wrap gap-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={'Describe it, like "Study abroad in 2028, about ₹30 lakh"'}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <Button variant="secondary" size="md" className="rounded-xl" onClick={submit}>
            Add
          </Button>
        </div>
        {customs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customs.map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-2 rounded-full border border-[#3155E0] bg-[#3155E0]/10 py-1.5 pl-3.5 pr-1.5 text-sm text-foreground dark:border-[#7B9AFF] dark:bg-[#7B9AFF]/10"
              >
                {c.title}
                <button
                  type="button"
                  onClick={c.onRemove}
                  aria-label="Remove"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
