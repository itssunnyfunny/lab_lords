import { Users, Grid, CreditCard, Sparkles, LayoutDashboard, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Multi-Branch Management",
    description: "Control all your study halls or libraries from a single, unified dashboard. Compare metrics and manage staff effortlessly.",
    icon: <LayoutDashboard className="w-6 h-6 text-cyan-400" />,
  },
  {
    title: "Visual Seat Allocation",
    description: "Map out your exact physical layout. Drag and drop students to seats, manage shifts seamlessly, and instantly spot available capacity.",
    icon: <Grid className="w-6 h-6 text-indigo-400" />,
  },
  {
    title: "Automated Billing & Dues",
    description: "Never lose track of payments again. Detailed ledgers, automated due-date tracking, and single-click payment recording.",
    icon: <CreditCard className="w-6 h-6 text-emerald-400" />,
  },
  {
    title: "AI-Powered Insights",
    description: "Your silent manager. Get intelligent alerts for expiring memberships, low utilization times, and revenue forecasts.",
    icon: <Sparkles className="w-6 h-6 text-amber-400" />,
  },
  {
    title: "Student Profiles & History",
    description: "Maintain comprehensive digital records of every student, their ID proofs, past allocations, and behavior logs.",
    icon: <Users className="w-6 h-6 text-purple-400" />,
  },
  {
    title: "Role-Based Access Control",
    description: "Safely delegate tasks to branch managers and staff. Granular permissions ensure your financial data stays private.",
    icon: <ShieldCheck className="w-6 h-6 text-rose-400" />,
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 relative z-10 border-t border-white/5 bg-[#050508]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-sm font-semibold tracking-wide text-cyan-500 uppercase mb-3">
            Core Features
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-6">
            Everything you need to run at scale
          </h3>
          <p className="text-lg text-gray-400">
            We&apos;ve built a specialized toolkit that replaces your registers and spreadsheets with an elegant, lightning-fast application.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:bg-white/[0.04] transition-all hover:border-white/10 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="bg-[#0c0d12] border border-white/10 w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-black/50">
                {feature.icon}
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">
                {feature.title}
              </h4>
              <p className="text-gray-400 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
