import { SignIn } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
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

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const fallbackRedirectUrl = getSafeRedirectPath(params?.redirect_url, "/org");

  if (isAuthBypassEnabled()) {
    redirect(fallbackRedirectUrl);
  }

  return (
    <main className={entryRootClass}>
      <AmbientBackground />

      <div className={cn(entryContentClass, "flex max-w-md flex-col items-center")}>
        <div className="mb-6 text-center sm:mb-8">
          <div className={cn(entryIconFrameClass, "mb-4 h-14 w-14 sm:h-16 sm:w-16")}>
            <Building2 size={32} />
          </div>
          <h1 className={cn(entryTitleClass, "mb-2")}>
            Lab Lords
          </h1>
          <p className={entrySubtitleClass}>Sign in to your workspace</p>
        </div>

        <SignIn
          fallbackRedirectUrl={fallbackRedirectUrl}
          signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
          appearance={{
            elements: entryClerkAppearanceElements,
          }}
        />
      </div>
    </main>
  );
}
