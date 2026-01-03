"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();

    const handleContinue = () => {
        router.push("/");
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
            <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-xl">
                <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">
                    Micro-ERP
                </h1>
                <p className="mb-8 text-center text-sm text-muted">
                    Offline Education Management
                </p>

                <button
                    onClick={handleContinue}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}
