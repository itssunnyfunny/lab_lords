"use client";

import { cn } from "@/lib/utils";
import { LayoutGrid, List, type LucideIcon } from "lucide-react";
import type { DataViewMode } from "./DataTable";

interface ViewToggleProps {
    value: DataViewMode;
    onChange: (value: DataViewMode) => void;
    className?: string;
}

const options: {
    value: DataViewMode;
    label: string;
    Icon: LucideIcon;
    activeClassName: string;
    dotClassName: string;
}[] = [
    {
        value: "table",
        label: "Table view",
        Icon: List,
        activeClassName: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20",
        dotClassName: "bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.65)]",
    },
    {
        value: "grid",
        label: "Grid view",
        Icon: LayoutGrid,
        activeClassName: "bg-violet-500/10 text-violet-300 ring-violet-500/20",
        dotClassName: "bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.65)]",
    },
];

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
    return (
        <div className={cn("inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1", className)}>
            {options.map(({ value: optionValue, label, Icon, activeClassName, dotClassName }) => {
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
                            "relative flex h-8 w-8 items-center justify-center rounded-md text-textMuted transition-colors",
                            "hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
                            active && "ring-1 shadow-sm",
                            active && activeClassName
                        )}
                    >
                        <Icon size={16} />
                        {active && (
                            <span
                                aria-hidden="true"
                                className={cn("absolute bottom-1 h-1 w-1 rounded-full", dotClassName)}
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
