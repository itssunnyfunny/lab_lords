import { Check } from "lucide-react";

export function LandingPricing({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <section id="pricing" className="py-24 relative z-10 border-t border-white/5 bg-[#050508]/80 line-pattern-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-semibold tracking-wide text-cyan-500 uppercase mb-3">
            Simple Pricing
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-6">
            Scale without limits.
          </h3>
          <p className="text-lg text-gray-400">
            Start for free, then choose a plan that perfectly fits the size of your operations. No hidden fees or complex contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Starter Plan */}
          <div className="bg-[#0c0d12] border border-white/10 rounded-3xl p-8 flex flex-col hover:border-white/20 transition-all">
            <h4 className="text-xl font-semibold text-white mb-2">Starter</h4>
            <p className="text-gray-400 text-sm mb-6">Perfect for a single starting branch.</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-white">Free</span>
              <span className="text-gray-500 font-medium"> / forever</span>
            </div>
            <button
              onClick={onDashboardClick}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-4 rounded-xl transition-all border border-white/10 mb-8"
            >
              Get Started
            </button>
            <div className="space-y-4 flex-1">
              {[
                "1 Branch Location",
                "Up to 50 Active Students",
                "Basic Seat Allocation",
                "Standard Dashboard",
                "Community Support"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-cyan-400" />
                  </div>
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-b from-[#0c0d12] to-[#0c0d12] border border-cyan-500/30 rounded-3xl p-8 flex flex-col relative shadow-[0_0_40px_-15px_rgba(6,182,212,0.3)] transform md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <h4 className="text-xl font-semibold text-white mb-2">Professional</h4>
            <p className="text-cyan-100/60 text-sm mb-6">For growing multi-branch businesses.</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-white">Rs.999</span>
              <span className="text-gray-500 font-medium"> / month</span>
            </div>
            <button
              onClick={onDashboardClick}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-500/20 mb-8"
            >
              Get Started
            </button>
            <div className="space-y-4 flex-1">
              {[
                "Up to 3 Branch Locations",
                "Unlimited Active Students",
                "Advanced Seat Mapping",
                "Payment & Due Tracking",
                "Manager Role Access",
                "Priority Email Support"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-cyan-400" />
                  </div>
                  <span className="text-white text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-[#0c0d12] border border-white/10 rounded-3xl p-8 flex flex-col hover:border-white/20 transition-all">
            <h4 className="text-xl font-semibold text-white mb-2">Enterprise</h4>
            <p className="text-gray-400 text-sm mb-6">Bespoke limits for large operations.</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-white">Custom</span>
            </div>
            <button
              onClick={onDashboardClick}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 px-4 rounded-xl transition-all border border-white/10 mb-8"
            >
              Get Started
            </button>
            <div className="space-y-4 flex-1">
              {[
                "Unlimited Branch Locations",
                "Custom Roles & Permissions",
                "AI-Powered Insights Module",
                "Detailed audit history",
                "Dedicated Success Manager",
                "24/7 Phone Support"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-gray-400" />
                  </div>
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
