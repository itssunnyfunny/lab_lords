import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlowTextProps {
    children: ReactNode;
    className?: string;
}

export const GlowText = ({ children, className = "" }: GlowTextProps) => (
    <span className={cn("bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-violet-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]", className)}>
        {children}
    </span>
);
