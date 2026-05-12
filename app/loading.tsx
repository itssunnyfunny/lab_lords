import { Loader2 } from "lucide-react";
import { pageLoadingStateClass } from "@/components/ui/pageSurface";

export default function Loading() {
    return (
        <div className={pageLoadingStateClass}>
            <Loader2 className="mr-2 animate-spin" size={20} />
            Loading...
        </div>
    );
}
