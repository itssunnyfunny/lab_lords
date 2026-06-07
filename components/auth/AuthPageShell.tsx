import type { ReactNode } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    CheckCircle2,
    ShieldCheck,
} from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";
import { AmbientBackground } from "@/components/ui/AmbientBackground";

type AuthPageShellProps = {
    children: ReactNode;
    mode: "sign-in" | "sign-up";
    legal?: ReactNode;
};

const signUpValuePoints = [
    "Set up your first branch in a guided flow.",
    "Manage seats, shifts, students, and fees in one place.",
    "Keep staff access clear and controlled.",
] as const;

const signInValuePoints = [
    "Return to branch dashboards and daily priorities.",
    "Keep students, seats, shifts, and fees in one place.",
    "Work with clear, controlled staff access.",
] as const;

export function AuthPageShell({ children, mode, legal }: AuthPageShellProps) {
    const isSignUp = mode === "sign-up";
    const valuePoints = isSignUp ? signUpValuePoints : signInValuePoints;

    return (
        <main className="relative min-h-[100dvh] overflow-hidden bg-[color:var(--bg-app)] text-[color:var(--text-primary)]">
            <AmbientBackground />

            <div className="relative z-10 grid min-h-[100dvh] lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)]">
                <aside className="relative hidden border-r border-[color:var(--ui-panel-header-border)] lg:flex lg:flex-col lg:p-10 xl:p-14">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_28%,rgba(6,182,212,0.1),transparent_38%)]" />

                    <div className="relative z-10">
                        <Link
                            href="/"
                            aria-label="Lab Lords home"
                            className="inline-flex rounded-[var(--ui-radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]"
                        >
                            <AppLogo subtitle="Branch OS" markClassName="h-10 w-10" />
                        </Link>
                    </div>

                    <div className="relative z-10 my-auto max-w-lg py-16">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ui-form-accent)]">
                            {isSignUp ? "Create your workspace" : "Welcome back"}
                        </p>
                        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] text-[color:var(--text-primary)] xl:text-5xl xl:leading-[1.08]">
                            {isSignUp
                                ? "Start with one branch. Grow from there."
                                : "Continue running your branches with clarity."}
                        </h1>
                        <p className="mt-5 max-w-md text-base leading-7 text-[color:var(--text-secondary)]">
                            A focused workspace for the daily operations that keep your branch moving.
                        </p>

                        <ul className="mt-9 space-y-4">
                            {valuePoints.map(point => (
                                <li key={point} className="flex items-start gap-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                                    <CheckCircle2
                                        size={18}
                                        className="mt-0.5 shrink-0 text-[color:var(--ui-tone-success-text)]"
                                        aria-hidden="true"
                                    />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>

                <section className="flex min-w-0 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
                    <header className="mx-auto flex w-full max-w-[460px] items-center justify-between gap-4 lg:justify-end">
                        <Link
                            href="/"
                            aria-label="Lab Lords home"
                            className="rounded-[var(--ui-radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)] lg:hidden"
                        >
                            <AppLogo subtitle="Branch OS" markClassName="h-9 w-9" />
                        </Link>
                        <Link
                            href="/"
                            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--ui-radius-control)] px-2 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--ui-button-quiet-hover-bg)] hover:text-[color:var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]"
                        >
                            <ArrowLeft size={15} />
                            <span className="hidden sm:inline">Back to home</span>
                            <span className="sm:hidden">Back</span>
                        </Link>
                    </header>

                    <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center py-6 sm:py-10">
                        <div className="mb-5 lg:hidden">
                            <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                                {isSignUp
                                    ? "Create your account. We will guide you through your first branch next."
                                    : "Sign in to continue to your workspace."}
                            </p>
                        </div>

                        <div className="w-full">{children}</div>

                        {legal && (
                            <div className="mx-auto mt-5 max-w-sm text-center text-xs leading-5 text-[color:var(--text-muted)]">
                                {legal}
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[color:var(--text-secondary)]">
                            <ShieldCheck size={14} className="text-[color:var(--ui-tone-success-text)]" />
                            Secure authentication and account recovery by Clerk.
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
