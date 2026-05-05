"use client";

import { ReactNode } from "react";
import Image from "next/image";

interface EmptyStateProps {
    title: string;
    description: string;
    actionScript?: ReactNode;
    image?: string;
}

export function EmptyState({ title, description, actionScript }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[500px]">
            <div className="relative w-64 h-64 mb-6 animate-float">
                {/* Placeholder until image serves */}
                <Image
                    src="/assets/astronaut_empty_state.png" // Will be placed here
                    alt="No Data"
                    fill
                    className="object-contain"
                />
                {/* Decorative elements */}
                <div className="absolute top-0 right-10 w-4 h-4 bg-primary rounded-full blur-xl animate-pulse" />
                <div className="absolute bottom-10 left-10 w-6 h-6 bg-purple-500 rounded-full blur-xl animate-pulse delay-700" />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-textSecondary max-w-md mb-8">{description}</p>

            {actionScript && (
                <div className="flex gap-4">
                    {actionScript}
                </div>
            )}
        </div>
    );
}
