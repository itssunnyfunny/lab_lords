import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface BadgeProps {
    children: ReactNode;
    variant?: "default" | "success" | "warning" | "purple" | "cyan" | "danger";
    className?: string;
}

export const Badge = ({ children, variant = "default", className }: BadgeProps) => {
    const variants = {
        default: "border-[color:var(--ui-badge-default-border)] bg-[color:var(--ui-badge-default-bg)] text-[color:var(--ui-badge-default-text)] shadow-[var(--ui-badge-default-shadow)]",
        success: "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)] shadow-[var(--ui-badge-success-shadow)]",
        warning: "border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)] shadow-[var(--ui-badge-warning-shadow)]",
        purple: "border-[color:var(--ui-badge-purple-border)] bg-[color:var(--ui-badge-purple-bg)] text-[color:var(--ui-badge-purple-text)] shadow-[var(--ui-badge-purple-shadow)]",
        cyan: "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)] shadow-[var(--ui-badge-cyan-shadow)]",
        danger: "border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)] text-[color:var(--ui-badge-danger-text)] shadow-[var(--ui-badge-danger-shadow)]",
    };

    return (
        <span className={cn(
            "inline-flex items-center rounded-[var(--ui-badge-radius)] border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
            variants[variant] || variants.default,
            className
        )}>
            {children}
        </span>
    );
};
