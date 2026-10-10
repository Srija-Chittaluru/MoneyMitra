"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

export interface RankRow {
  id: string;
  title: string;
  sub?: string;
}

/** Drag-and-drop reorder (with up/down buttons as a non-drag fallback) — used for the rank step and the main view's "Rank goals". */
export function StepRank({ rows, onReorder }: { rows: RankRow[]; onReorder: (order: string[]) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);

  function move(id: string, delta: number) {
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReorder(ids);
  }

  function dropOnto(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = rows.map((r) => r.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    onReorder(ids);
    setDragId(null);
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div
          key={row.id}
          draggable
          onDragStart={() => setDragId(row.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => dropOnto(row.id)}
          onDragEnd={() => setDragId(null)}
          className={cn(
            "flex items-center gap-3.5 rounded-2xl border border-line bg-field py-3 pl-4 pr-3 transition-colors",
            dragId === row.id && "opacity-50",
          )}
        >
          <GripVertical className="h-4 w-4 shrink-0 text-muted" />
          <div className="w-7 shrink-0 font-mono text-xl text-[#3155E0] dark:text-[#7B9AFF]">{i + 1}</div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-foreground">{row.title}</div>
            {row.sub && <div className="text-sm text-muted">{row.sub}</div>}
          </div>
          <button
            type="button"
            onClick={() => move(row.id, -1)}
            disabled={i === 0}
            aria-label="Move up"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-foreground disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(row.id, 1)}
            disabled={i === rows.length - 1}
            aria-label="Move down"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-foreground disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
