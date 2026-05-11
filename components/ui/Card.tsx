import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
    children: ReactNode;
    className?: string;
    title?: string;
    action?: ReactNode;
    noHover?: boolean;
}

export function Card({ children, className = "", title, action, noHover = false }: CardProps) {
    return (
        <div className={cn(
            "relative overflow-hidden",
            "bg-[color:var(--ui-card-bg)] backdrop-blur-2xl",
            "border border-[color:var(--ui-card-border)]",
            "shadow-[var(--ui-card-shadow)]",
            "rounded-[var(--ui-card-radius)] p-4 md:p-6",
            !noHover && "transition-all duration-300 hover:border-[color:var(--ui-card-hover-border)] hover:bg-[color:var(--ui-card-hover-bg)] hover:shadow-[var(--ui-card-hover-shadow)]",
            className
        )}>
            {/* Top highlight line for glass effect */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-[image:linear-gradient(to_right,transparent,var(--ui-card-highlight),transparent)] opacity-50" />

            {(title || action) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    {title && <h3 className="font-bold tracking-tight text-[color:var(--ui-card-title)]">{title}</h3>}
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}

            {children}
        </div>
    );
}
