import Link from "next/link";

export function LandingNavbar({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-white/5 bg-[#050508]/60 px-4 py-4 backdrop-blur-xl sm:px-6 md:py-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#06b6d4] to-blue-600 shadow-lg shadow-cyan-500/20 sm:h-9 sm:w-9">
          <span className="text-base font-bold text-white sm:text-lg">L</span>
        </div>
        <span className="truncate text-lg font-semibold tracking-wide text-white sm:text-xl">
          Lab Lords
        </span>
      </div>

      <div className="hidden md:flex items-center space-x-10 text-sm font-medium text-[#8b949e]">
        <Link href="#features" className="hover:text-white transition-colors duration-200">
          Features
        </Link>
        <Link href="#how-it-works" className="hover:text-white transition-colors duration-200">
          How it Works
        </Link>
        <Link href="#pricing" className="hover:text-white transition-colors duration-200">
          Pricing
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4 md:gap-6">
        <button
          className="hidden text-sm font-medium text-[#8b949e] transition-colors hover:text-white sm:inline"
          onClick={onDashboardClick}
        >
          Login
        </button>
        <button
          onClick={onDashboardClick}
          className="rounded-lg bg-white px-3 py-2.5 text-sm font-semibold text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-colors hover:bg-gray-100 sm:px-5"
        >
          <span className="hidden sm:inline">Go to </span>Dashboard
        </button>
      </div>
    </nav>
  );
}
