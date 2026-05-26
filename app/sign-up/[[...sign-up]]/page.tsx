import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { isAuthBypassEnabled } from "@/lib/authMode";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/AppLogo";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { getSafeRedirectPath } from "@/lib/safeRedirect";
import { cn } from "@/lib/utils";
import {
  entryClerkAppearanceElements,
  entryContentClass,
  entryIconFrameClass,
  entryRootClass,
  entrySubtitleClass,
  entryTitleClass,
} from "@/components/ui/entrySurface";

export const metadata: Metadata = {
  title: "Sign up",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const fallbackRedirectUrl = getSafeRedirectPath(params?.redirect_url, "/onboarding");

  if (isAuthBypassEnabled()) {
    redirect(fallbackRedirectUrl);
  }

  return (
    <main className={entryRootClass}>
      <AmbientBackground />

      <div className={cn(entryContentClass, "flex max-w-md flex-col items-center")}>
        <div className="mb-6 text-center sm:mb-8">
          <div className={cn(entryIconFrameClass, "mb-4 h-14 w-14 sm:h-16 sm:w-16")}>
            <LogoMark className="h-11 w-11 sm:h-12 sm:w-12" title="Lab Lords logo" />
          </div>
          <h1 className={cn(entryTitleClass, "mb-2")}>
            Lab Lords
          </h1>
          <p className={entrySubtitleClass}>Create your workspace account</p>
        </div>

        <SignUp
          fallbackRedirectUrl={fallbackRedirectUrl}
          signInUrl={`/sign-in?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
          appearance={{
            elements: entryClerkAppearanceElements,
          }}
        />

        <p className="mt-4 text-center text-xs leading-5 text-[color:var(--text-muted)]">
          By continuing, you agree to the{" "}
          <Link className="text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]" href="/terms">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link className="text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
