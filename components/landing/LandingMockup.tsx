import { Users, LayoutDashboard, Grid, ArrowUpRight, ArrowDownRight, Layers, CreditCard, Activity } from "lucide-react";

export function LandingMockup() {
  return (
    <div
      className="w-full max-w-6xl mx-auto mt-20 relative px-4 z-10 pb-32"
      style={{ animationDelay: "0.4s" }}
    >
      {/* Intense Glowing gradients perfectly matching the image's style */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* The Floating UI Frame */}
      <div className="animate-fade-in-up opacity-0 relative group">
        
        {/* Glow behind the mockup */}
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 via-indigo-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-60"></div>
        
        <div className="animate-float relative rounded-2xl bg-[#030305] border border-white/10 shadow-[0_30px_100px_-20px_rgba(0,0,0,1)] overflow-hidden flex flex-col items-center">
          
          {/* Glass header for the mock browser/app frame */}
          <div className="w-full h-12 bg-white/[0.02] border-b border-white/5 flex items-center px-4 gap-2 backdrop-blur-md relative z-20">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
            </div>
            <div className="mx-auto w-64 h-6 bg-black/50 border border-white/5 rounded-md flex items-center justify-center">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest">Lab Lords OS</span>
            </div>
          </div>
          
          <div className="w-full flex h-[600px] bg-[#050508]">
            {/* Elegant Sidebar Navigation */}
            <div className="w-64 border-r border-white/5 bg-[#030305] p-6 hidden md:flex flex-col gap-8 relative z-10">
              {/* Profile Block */}
              <div className="flex items-center gap-3 w-full p-2 bg-white/5 border border-white/5 rounded-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <span className="font-bold text-white shadow-sm">D</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Downtown Branch</h4>
                  <p className="text-xs text-gray-500">Premium Plan</p>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 px-3">Overview</div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <LayoutDashboard size={18} />
                  <span className="text-sm font-medium">Dashboard</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-default transition-colors">
                  <Users size={18} />
                  <span className="text-sm font-medium">Students</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-default transition-colors">
                  <Grid size={18} />
                  <span className="text-sm font-medium">Seat Map</span>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-default transition-colors">
                  <CreditCard size={18} />
                  <span className="text-sm font-medium">Payments</span>
                </div>
              </nav>

              {/* Sparkline minimal mock */}
              <div className="mt-auto p-4 rounded-xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-gray-400">Weekly Seats</span>
                  <span className="text-xs font-bold text-emerald-400">+12%</span>
                </div>
                <div className="flex items-end gap-1.5 h-10 w-full">
                  {[40, 60, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-cyan-500/50 to-cyan-400/80 rounded-sm" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Breathtaking Main Content Area */}
            <div className="flex-1 p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0c0c16] to-[#030305] relative overflow-hidden">
              
              {/* Inner ambient light */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full"></div>

              <div className="flex justify-between items-center mb-8 relative z-10">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">Branch Overview</h3>
                  <p className="text-sm text-gray-400 mt-1">Live metrics from your facility.</p>
                </div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-4 py-2 rounded-lg shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-400">Live Sync</span>
                </div>
              </div>

              {/* Rich Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
                
                {/* Stat Card 1 */}
                <div className="relative group p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 backdrop-blur-md shadow-xl overflow-hidden hover:border-cyan-500/30 transition-all duration-300">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                      <Layers size={22} />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                      <ArrowUpRight size={14} /> 4.2%
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm font-medium mb-1">Seat Utilization</div>
                  <div className="text-4xl font-extrabold text-white tracking-tighter">85.4%</div>
                </div>

                {/* Stat Card 2 */}
                <div className="relative group p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 backdrop-blur-md shadow-xl overflow-hidden hover:border-indigo-500/30 transition-all duration-300">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.15)]">
                      <Users size={22} />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">
                      <ArrowUpRight size={14} /> 12 Active
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm font-medium mb-1">Total Students</div>
                  <div className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300 tracking-tighter">248</div>
                </div>

                {/* Stat Card 3 */}
                <div className="relative group p-6 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/5 backdrop-blur-md shadow-xl overflow-hidden hover:border-purple-500/30 transition-all duration-300">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                      <Activity size={22} />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-rose-500/10 text-rose-400 rounded-md border border-rose-500/20">
                      <ArrowDownRight size={14} /> 1.1%
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm font-medium mb-1">Monthly Revenue</div>
                  <div className="text-4xl font-extrabold text-white tracking-tighter">Rs.1.42L</div>
                </div>

              </div>

              {/* Complex Table/Feed Area */}
              <div className="w-full h-64 border border-white/5 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden shadow-2xl relative z-10 flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-sm">
                  <h4 className="text-sm font-semibold text-white">Recent Activity</h4>
                  <span className="text-xs font-medium text-cyan-400">View All</span>
                </div>
                
                <div className="flex-1 p-2 flex flex-col gap-1 overflow-hidden">
                  {[
                    { title: "Seat A12 Allocated", desc: "Aarav Sharma newly enrolled.", time: "2m ago", color: "text-cyan-400", bg: "bg-cyan-500/10" },
                    { title: "Payment Received", desc: "Rs.2,500 from Priya Patel.", time: "1hr ago", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { title: "Overdue Alert", desc: "5 students exceeded 7 days limit.", time: "3hr ago", color: "text-rose-400", bg: "bg-rose-500/10" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white-[0.02] transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border border-white/5 ${item.bg}`}>
                           <Activity size={16} className={item.color} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-600">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Fade out absolute overlay at bottom so it blends with background */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#030305] to-transparent pointer-events-none z-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
