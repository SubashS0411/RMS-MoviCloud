import React from "react";
import { cn } from "@/client/app/components/ui/utils";

export type NotificationFilter =
  | "all"
  | "unread"
  | "success"
  | "pending"
  | "failed"
  | "info";

const FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "success", label: "Success" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
  { id: "info", label: "Info" },
];

export function NotificationFilters({
  value,
  onChange,
}: {
  value: NotificationFilter;
  onChange: (value: NotificationFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => {
        const active = f.id === value;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={cn(
              "h-8 sm:h-9 px-3.5 sm:px-4 rounded-full border text-[11px] sm:text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-[#F8F1E7] text-[#5D4037] border-[#E8DED0] hover:bg-[#EFE3D2]",
            )}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
