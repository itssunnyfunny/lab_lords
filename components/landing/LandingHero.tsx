export function LandingHero({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center mt-32 px-4 max-w-5xl mx-auto z-10 relative">
      <div className="animate-fade-in-up bg-[#06b6d4]/10 border border-[#06b6d4]/30 text-[#06b6d4] text-xs px-4 py-1.5 rounded-full mb-8 tracking-widest font-semibold uppercase shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:bg-[#06b6d4]/20 transition-colors cursor-default">
        Intelligence meets Operations
      </div>

      <h1
        style={{ animationDelay: "0.1s" }}
        className="animate-fade-in-up opacity-0 text-5xl md:text-[5.5rem] leading-[1.1] font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-50 to-[#9ba1a6] mb-8 drop-shadow-sm"
      >
        The Operating System for <br className="hidden md:block" /> Offline Education.
      </h1>

      <p
        style={{ animationDelay: "0.2s" }}
        className="animate-fade-in-up opacity-0 text-xl md:text-2xl text-[#8b949e] max-w-3xl mb-12 leading-relaxed"
      >
        Manage seats, students, shifts, and collections—all in one elegant place. Stop fighting legacy software and start running your branch with clarity.
      </p>

      <div
        style={{ animationDelay: "0.3s" }}
        className="animate-fade-in-up opacity-0 flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <button
          onClick={onDashboardClick}
          className="w-full sm:w-auto bg-[#06b6d4] hover:bg-[#0891b2] text-white font-semibold text-lg px-8 py-4 rounded-xl transition-all shadow-[0_0_40px_-5px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Start Free Trial
        </button>
        <button
          onClick={onDashboardClick}
          className="w-full sm:w-auto text-white hover:bg-white/5 font-semibold text-lg px-8 py-4 rounded-xl transition-all border border-white/10 hover:border-white/20"
        >
          View Live Demo
        </button>
      </div>
    </div>
  );
}
