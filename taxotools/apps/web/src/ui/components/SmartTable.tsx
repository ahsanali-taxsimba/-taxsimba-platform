"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem } from "@/ui/animations";
import { StatusTag } from "./StatusTag";
import { Card } from "./Card";

export type SmartColumn<T> = {
  id: string;
  header: string;
  sticky?: boolean;
  render: (row: T) => React.ReactNode;
  editKey?: keyof T & string;
};

export function SmartTable<T extends { id: string }>({
  columns,
  rows,
  onEdit,
  className,
}: {
  columns: SmartColumn<T>[];
  rows: T[];
  onEdit?: (id: string, key: string, value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <Card surface="solid" className={cn("overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border-subtle)] bg-[var(--bg-muted)]/90 backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]",
                    col.sticky && "sticky left-0 z-20 bg-[var(--bg-muted)]",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <m.tbody variants={staggerContainer} initial="hidden" animate="visible">
            {rows.map((row) => (
              <m.tr
                key={row.id}
                variants={staggerItem}
                className="border-b border-[var(--border-subtle)]/70 transition-colors hover:bg-[var(--accent-soft)]/40"
              >
                {columns.map((col) => {
                  const isEditing = editing?.id === row.id && editing.key === col.editKey;
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "px-4 py-3 align-middle text-[var(--text-main)]",
                        col.sticky && "sticky left-0 z-10 bg-[var(--bg-panel)]",
                      )}
                      onDoubleClick={() => {
                        if (!col.editKey || !onEdit) return;
                        setEditing({ id: row.id, key: col.editKey });
                        setDraft(String(row[col.editKey] ?? ""));
                      }}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-2 py-1 outline-none ring-[var(--accent-blue)] focus:ring-2"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => {
                            onEdit?.(row.id, col.editKey!, draft);
                            setEditing(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onEdit?.(row.id, col.editKey!, draft);
                              setEditing(null);
                            }
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                      ) : (
                        col.render(row)
                      )}
                    </td>
                  );
                })}
              </m.tr>
            ))}
          </m.tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No rows yet.</p>
      )}
    </Card>
  );
}

export { StatusTag };
