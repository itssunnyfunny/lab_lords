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
            "bg-[#0f111a]/40 backdrop-blur-2xl",
            "border border-white/5",
            "shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]",
            "rounded-2xl p-6",
            !noHover && "hover:bg-[#161822]/50 hover:border-white/10 hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.1)] transition-all duration-300",
            className
        )}>
            {/* Top highlight line for glass effect */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

            {(title || action) && (
                <div className="flex items-center justify-between mb-4">
                    {title && <h3 className="font-bold text-white tracking-tight">{title}</h3>}
                    {action && <div>{action}</div>}
                </div>
            )}

            {children}
        </div>
    );
}
