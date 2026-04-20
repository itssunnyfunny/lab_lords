import { Building2, UserPlus, MonitorSmartphone, TrendingUp } from "lucide-react";

export function LandingHowItWorks() {
  const steps = [
    {
      step: "01",
      title: "Set up your branches",
      description: "Define your physical branch locations, operating hours, and create the exact floor plan mapping your physical seats to the digital workspace.",
      icon: <Building2 className="w-5 h-5 text-cyan-400" />,
    },
    {
      step: "02",
      title: "Add your students",
      description: "Onboard students in seconds. Capture essential contact details, ID proofs, and preferences all in one secure, searchable database.",
      icon: <UserPlus className="w-5 h-5 text-indigo-400" />,
    },
    {
      step: "03",
      title: "Allocate seats dynamically",
      description: "Assign students to specific seats based on shifts. Our system automatically prevents double-booking while optimizing your floor capacity.",
      icon: <MonitorSmartphone className="w-5 h-5 text-emerald-400" />,
    },
    {
      step: "04",
      title: "Track revenue & grow",
      description: "Monitor payments, detect upcoming dues, and leverage AI analytics to understand your business health and utilization metrics.",
      icon: <TrendingUp className="w-5 h-5 text-amber-400" />,
    },
  ];

  return (
    <section id="how-it-works" className="py-24 relative z-10 bg-[#050508]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2">
            <h2 className="text-sm font-semibold tracking-wide text-cyan-500 uppercase mb-3">
              How it Works
            </h2>
            <h3 className="text-3xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
              From chaos to <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                complete control.
              </span>
            </h3>
            <p className="text-lg text-gray-400 mb-8 max-w-lg">
              Our refined workflow is designed to map exactly to the real-world operations of your study hall or offine education business.
            </p>
            
            <div className="flex items-center gap-4">
              <div className="flex -space-x-4">
                <img className="w-12 h-12 rounded-full border-2 border-[#050508]" src="https://i.pravatar.cc/100?img=1" alt="User" />
                <img className="w-12 h-12 rounded-full border-2 border-[#050508]" src="https://i.pravatar.cc/100?img=2" alt="User" />
                <img className="w-12 h-12 rounded-full border-2 border-[#050508]" src="https://i.pravatar.cc/100?img=3" alt="User" />
              </div>
              <div className="text-sm text-gray-400">
                <strong className="text-white">Join 500+</strong> owners managing<br/>their businesses today.
              </div>
            </div>
          </div>

          <div className="lg:w-1/2 space-y-8">
            {steps.map((item, index) => (
              <div key={index} className="flex gap-6 relative">
                {index !== steps.length - 1 && (
                  <div className="absolute left-6 top-14 bottom-[-32px] w-px bg-gradient-to-b from-white/10 to-transparent" />
                )}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#0c0d12] border border-white/10 flex items-center justify-center font-bold text-gray-500 z-10 shadow-lg">
                  {item.step}
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-3 mb-2">
                    {item.icon}
                    <h4 className="text-xl font-semibold text-white">{item.title}</h4>
                  </div>
                  <p className="text-gray-400 leading-relaxed max-w-md">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
