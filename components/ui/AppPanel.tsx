import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, ReactNode } from "react";

interface AppPanelProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
    title?: ReactNode;
    description?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    density?: "comfortable" | "compact";
    padding?: "default" | "none";
}

export function AppPanel({
    title,
    description,
    action,
    children,
    className,
    contentClassName,
    density = "comfortable",
    padding = "default",
    ...props
}: AppPanelProps) {
    const hasHeader = title || description || action;

    return (
        <section
            className={cn(
                density === "compact" ? "ui-panel--compact" : "overflow-hidden rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] shadow-[var(--ui-panel-shadow)]",
                className
            )}
            {...props}
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
            {padding === "none" ? children : <div className={cn("p-4", contentClassName)}>{children}</div>}
        </section>
    );
}
