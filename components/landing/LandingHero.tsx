export function LandingHero({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <div className="relative z-10 mx-auto mt-20 flex max-w-5xl flex-col items-center px-4 text-center sm:mt-24 sm:px-6 md:mt-32">
      <div className="mb-6 max-w-full animate-fade-in-up cursor-default rounded-full border border-[#06b6d4]/30 bg-[#06b6d4]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-colors hover:bg-[#06b6d4]/20 sm:px-4 sm:text-xs md:mb-8">
        Intelligence meets Operations
      </div>

      <h1
        style={{ animationDelay: "0.1s" }}
        className="mb-5 animate-fade-in-up bg-gradient-to-b from-white via-blue-50 to-[#9ba1a6] bg-clip-text text-4xl font-extrabold leading-[1.1] tracking-tight text-transparent opacity-0 drop-shadow-sm sm:mb-8 sm:text-5xl md:text-[5.5rem]"
      >
        The Operating System for <br className="hidden md:block" /> Offline Education.
      </h1>

      <p
        style={{ animationDelay: "0.2s" }}
        className="mb-8 max-w-3xl animate-fade-in-up text-base leading-relaxed text-[#8b949e] opacity-0 sm:mb-12 sm:text-lg md:text-2xl"
      >
        Manage seats, students, shifts, and collections, all in one elegant place. Stop fighting legacy software and start running your branch with clarity.
      </p>

      <div
        style={{ animationDelay: "0.3s" }}
        className="flex w-full animate-fade-in-up flex-col items-center justify-center gap-3 opacity-0 sm:w-auto sm:flex-row sm:gap-4"
      >
        <button
          onClick={onDashboardClick}
          className="w-full rounded-xl bg-[#06b6d4] px-5 py-3.5 text-base font-semibold text-white shadow-[0_0_40px_-5px_rgba(6,182,212,0.5)] transition-all hover:-translate-y-0.5 hover:bg-[#0891b2] active:translate-y-0 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
        >
          Start Free Trial
        </button>
        <button
          onClick={onDashboardClick}
          className="w-full rounded-xl border border-white/10 px-5 py-3.5 text-base font-semibold text-white transition-all hover:border-white/20 hover:bg-white/5 sm:w-auto sm:px-8 sm:py-4 sm:text-lg"
        >
          View Live Demo
        </button>
      </div>
    </div>
  );
}
