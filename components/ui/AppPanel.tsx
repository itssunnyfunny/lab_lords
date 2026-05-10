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
                "overflow-hidden rounded-[8px] border border-white/10 bg-[#0b0f14]/80 shadow-sm shadow-black/20",
                className
            )}
        >
            {hasHeader && (
                <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
                        {description && <p className="mt-1 text-xs leading-5 text-gray-400">{description}</p>}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}
            <div className={cn("p-4", contentClassName)}>{children}</div>
        </section>
    );
}
