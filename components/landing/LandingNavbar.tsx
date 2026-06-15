import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";
import {
  landingContainerClass,
  landingNavLinkClass,
  landingPrimaryButtonClass,
} from "@/components/ui/landingSurface";
import {
  accountMenuClerkAppearance,
  accountProfileClerkAppearance,
} from "@/components/ui/entrySurface";

export function LandingNavbar({
  isSignedIn,
  onSignInClick,
  onWorkspaceClick,
}: {
  isSignedIn: boolean;
  onSignInClick: (source: string) => void;
  onWorkspaceClick: (source: string) => void;
}) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--ui-panel-header-border)] bg-[color:var(--bg-app)]/88 backdrop-blur-xl">
      <div className={`${landingContainerClass} flex h-16 items-center justify-between gap-4`}>
        <AppLogo
          className="landing-reveal"
          subtitleClassName="hidden sm:block"
        />

        <div className="landing-reveal hidden items-center gap-8 [animation-delay:120ms] md:flex">
          <Link href="#platform" className={landingNavLinkClass}>
            Platform
          </Link>
          <Link href="#software" className={landingNavLinkClass}>
            Software
          </Link>
          <Link href="#workflow" className={landingNavLinkClass}>
            Workflow
          </Link>
          <Link href="#pricing" className={landingNavLinkClass}>
            Pricing
          </Link>
        </div>

        <div className="landing-reveal flex shrink-0 items-center gap-2 [animation-delay:220ms]">
          {!isSignedIn && (
            <button
              type="button"
              className="text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
              onClick={() => onSignInClick("landing_nav_sign_in")}
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={() => onWorkspaceClick("landing_nav_workspace")}
            className={`${landingPrimaryButtonClass} landing-cta-shine h-10 px-3 sm:px-4`}
          >
            {isSignedIn ? (
              <>
                <span className="hidden sm:inline">Open workspace</span>
                <span className="sm:hidden">Open</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Start with your branch</span>
                <span className="sm:hidden">Start</span>
              </>
            )}
            <ArrowRight size={14} />
          </button>
          {isSignedIn && (
            <UserButton
              appearance={accountMenuClerkAppearance}
              userProfileMode="modal"
              userProfileProps={{ appearance: accountProfileClerkAppearance }}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
