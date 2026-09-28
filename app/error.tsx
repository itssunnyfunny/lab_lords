"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppButton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import { entryPanelClass, entryRootClass, entrySubtitleClass, entryTitleClass } from "@/components/ui/entrySurface";
import { isSelectedApplicationSurfacePath } from "@/lib/applicationDesignPilot";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const selected = isSelectedApplicationSurfacePath(usePathname());
    const t = useTranslation();
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className={entryRootClass} data-app-design-pilot={selected ? "workspace" : undefined}>
            <section className={cn(entryPanelClass, "w-full max-w-md p-5 sm:p-6")}>
                <div className="space-y-2">
                    <h1 className={entryTitleClass}>{selected ? t("Something went wrong") : "Something went wrong"}</h1>
                    <p className={entrySubtitleClass}>{selected ? t("The app hit an unexpected problem on this screen.") : "The app hit an unexpected problem on this screen."}</p>
                </div>
                <div className={cn("mt-5 p-4", formErrorBannerClass)}>
                    <p className="break-words font-mono text-sm">
                        {selected ? t.error(error) : error.message || "An unexpected error occurred."}
                    </p>
                </div>
                <div className="mt-5 flex justify-end">
                    <AppButton variant="primary" onClick={() => reset()}>
                        {selected ? t("Try again") : "Try again"}
                    </AppButton>
                </div>
            </section>
        </div>
    );
}
