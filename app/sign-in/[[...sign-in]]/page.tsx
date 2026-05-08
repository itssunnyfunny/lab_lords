import { SignIn } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { getSafeRedirectPath } from "@/lib/safeRedirect";

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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden overflow-y-auto bg-[#050508] p-4 text-white sm:p-6">
      <AmbientBackground />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[80px] mix-blend-screen sm:h-[600px] sm:w-[600px] sm:blur-[100px]" />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="mb-6 text-center sm:mb-8">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-cyan-500/20 shadow-[0_0_30px_rgba(139,92,246,0.2)] backdrop-blur-md sm:h-16 sm:w-16">
            <Building2 size={32} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <GlowText>Lab Lords</GlowText>
          </h1>
          <p className="text-sm text-gray-400">Sign in to your workspace</p>
        </div>

        <SignIn
          fallbackRedirectUrl={fallbackRedirectUrl}
          signUpUrl={`/sign-up?redirect_url=${encodeURIComponent(fallbackRedirectUrl)}`}
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "w-full",
              card: "w-full max-w-full bg-[#0f111a]/85 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              socialButtonsBlockButton: "border-white/10 bg-white/5 text-white hover:bg-white/10",
              formFieldInput: "bg-[#050508]/50 border-white/10 text-white",
              formButtonPrimary: "bg-cyan-500 text-[#031316] hover:bg-cyan-400",
              footerActionText: "text-gray-500",
              footerActionLink: "text-cyan-300 hover:text-cyan-200",
            },
          }}
        />
      </div>
    </main>
  );
}
