import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { getSafeRedirectPath } from "@/lib/safeRedirect";
import { entryClerkAppearance } from "@/components/ui/entrySurface";

export const metadata: Metadata = {
  title: "Sign in",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const fallbackRedirectUrl = getSafeRedirectPath(params?.redirect_url, "/app");

  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        fallbackRedirectUrl={fallbackRedirectUrl}
        signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
        appearance={entryClerkAppearance}
      />
    </AuthPageShell>
  );
}
