import { SignUp } from "@clerk/nextjs";
import { LocalizedText } from "@/components/settings/LocalizedText";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { getSafeRedirectPath } from "@/lib/safeRedirect";
import { publicAuthAppearance } from "@/components/auth/publicAuthAppearance";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";

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
    <div className={publicDisplayFont.variable}><AuthPageShell
      mode="sign-up"
      legal={(
        <p>
          <LocalizedText text="By continuing, you agree to the" />{" "}
          <Link className="text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]" href="/terms">
            <LocalizedText text="Terms of Service" />
          </Link>{" "}
          <LocalizedText text="and" />{" "}
          <Link className="text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]" href="/privacy">
            <LocalizedText text="Privacy Policy" />
          </Link>
          .
        </p>
      )}
    >
      <SignUp
        fallbackRedirectUrl={fallbackRedirectUrl}
        signInUrl={`/sign-in?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
        appearance={publicAuthAppearance}
      />
    </AuthPageShell></div>
  );
}
