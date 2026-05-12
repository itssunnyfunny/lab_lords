"use client";

import { useEffect } from "react";
import { AppButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import { entryPanelClass, entryRootClass, entrySubtitleClass, entryTitleClass } from "@/components/ui/entrySurface";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className={entryRootClass}>
            <section className={cn(entryPanelClass, "w-full max-w-md p-5 sm:p-6")}>
                <div className="space-y-2">
                    <h1 className={entryTitleClass}>Something went wrong</h1>
                    <p className={entrySubtitleClass}>The app hit an unexpected problem on this screen.</p>
                </div>
                <div className={cn("mt-5 p-4", formErrorBannerClass)}>
                    <p className="break-words font-mono text-sm">
                        {error.message || "An unexpected error occurred."}
                    </p>
                </div>
                <div className="mt-5 flex justify-end">
                    <AppButton variant="primary" onClick={() => reset()}>
                        Try again
                    </AppButton>
                </div>
            </section>
        </div>
    );
}
