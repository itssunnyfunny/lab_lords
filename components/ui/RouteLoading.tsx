"use client";

import { usePathname } from "next/navigation";
import { isSelectedApplicationSurfacePath } from "@/lib/applicationDesignPilot";
import { PageLoadingSkeleton } from "@/components/ui";

export default function Loading() {
    const selected = isSelectedApplicationSurfacePath(usePathname());
    const skeleton = <PageLoadingSkeleton label="Loading page" variant="workspace" />;
    return selected ? <div data-app-design-pilot="workspace">{skeleton}</div> : skeleton;
}
