import Link from "next/link";

export function LandingNavbar({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <nav className="w-full flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#050508]/60 backdrop-blur-xl sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06b6d4] to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <span className="text-white font-bold text-lg">L</span>
        </div>
        <span className="text-white font-semibold text-xl tracking-wide">
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

      <div className="flex items-center gap-6">
        <button
          className="text-sm font-medium text-[#8b949e] hover:text-white transition-colors"
          onClick={onDashboardClick}
        >
          Login
        </button>
        <button
          onClick={onDashboardClick}
          className="bg-white text-black px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          Go to Dashboard
        </button>
      </div>
    </nav>
  );
}
