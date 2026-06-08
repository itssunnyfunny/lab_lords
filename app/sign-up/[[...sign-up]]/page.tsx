import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { getSafeRedirectPath } from "@/lib/safeRedirect";
import { entryClerkAppearance } from "@/components/ui/entrySurface";

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
  const fallbackRedirectUrl = getSafeRedirectPath(params?.redirect_url, "/app");

  return (
    <AuthPageShell
      mode="sign-up"
      legal={(
        <p>
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
      )}
    >
      <SignUp
        fallbackRedirectUrl={fallbackRedirectUrl}
        signInUrl={`/sign-in?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
        appearance={entryClerkAppearance}
      />
    </AuthPageShell>
  );
}
