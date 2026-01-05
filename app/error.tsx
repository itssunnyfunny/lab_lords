"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
        <div className="flex h-screen w-full items-center justify-center bg-[#0f172a] p-4">
            <Card title="Something went wrong" className="w-full max-w-md border-red-900/50 bg-[#1e293b]">
                <div className="p-6 space-y-4">
                    <div className="bg-red-950/30 p-4 rounded-lg border border-red-900/50">
                        <p className="text-red-400 text-sm font-mono break-words">
                            {error.message || "An unexpected error occurred."}
                        </p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="primary"
                            onClick={() => reset()}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
