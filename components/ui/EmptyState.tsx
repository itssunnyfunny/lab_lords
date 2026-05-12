"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { pageEmptyStateClass, pageMutedTextClass } from "@/components/ui/pageSurface";

interface EmptyStateProps {
    title: string;
    description: string;
    actionScript?: ReactNode;
    image?: string;
}

export function EmptyState({ title, description, actionScript }: EmptyStateProps) {
    return (
        <div className={cn(pageEmptyStateClass, "h-[500px] border-solid")}>
            <div className="relative mb-6 h-48 w-48 opacity-90 sm:h-56 sm:w-56">
                <Image
                    src="/assets/astronaut_empty_state.png"
                    alt="No Data"
                    fill
                    className="object-contain"
                />
            </div>

            <h3 className="mb-2 text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
            <p className={cn("mb-8 max-w-md", pageMutedTextClass)}>{description}</p>

            {actionScript && (
                <div className="flex gap-4">
                    {actionScript}
                </div>
            )}
        </div>
    );
}
