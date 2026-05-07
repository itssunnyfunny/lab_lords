"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, List, type LucideIcon } from "lucide-react";
import type { DataViewMode } from "./DataTable";

interface ViewToggleProps {
    value: DataViewMode;
    onChange: (value: DataViewMode) => void;
    className?: string;
}

const options: { value: DataViewMode; label: string; Icon: LucideIcon }[] = [
    { value: "table", label: "Table view", Icon: List },
    { value: "grid", label: "Grid view", Icon: LayoutGrid },
];

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
    return (
        <div className={cn("inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1", className)}>
            {options.map(({ value: optionValue, label, Icon }) => {
                const active = value === optionValue;

                return (
                    <button
                        key={optionValue}
                        type="button"
                        aria-label={label}
                        aria-pressed={active}
                        title={label}
                        onClick={() => onChange(optionValue)}
                        className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md text-textMuted transition-colors",
                            "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                            active && "bg-brand-500/20 text-brand-300 shadow-sm"
                        )}
                    >
                        <Icon size={16} />
                    </button>
                );
            })}
        </div>
    );
}
