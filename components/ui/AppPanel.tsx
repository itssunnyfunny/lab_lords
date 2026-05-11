import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface AppPanelProps {
    title?: string;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}

export function AppPanel({
    title,
    description,
    action,
    children,
    className,
    contentClassName,
}: AppPanelProps) {
    const hasHeader = title || description || action;

    return (
        <section
            className={cn(
                "overflow-hidden rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] shadow-[var(--ui-panel-shadow)]",
                className
            )}
        >
            {hasHeader && (
                <div className="flex flex-col gap-3 border-b border-[color:var(--ui-panel-header-border)] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        {title && <h2 className="text-sm font-semibold text-[color:var(--ui-panel-title)]">{title}</h2>}
                        {description && (
                            <p className="mt-1 text-xs leading-5 text-[color:var(--ui-panel-description)]">
                                {description}
                            </p>
                        )}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}
            <div className={cn("p-4", contentClassName)}>{children}</div>
        </section>
    );
}
