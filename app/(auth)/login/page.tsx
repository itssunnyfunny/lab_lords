"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050508]">
            <AmbientBackground />

            {/* Center Glow Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

            <div className="relative z-10 w-full max-w-md p-6">
                <div className="text-center mb-10 space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 mb-2 shadow-[0_0_30px_rgba(139,92,246,0.2)] backdrop-blur-md">
                        <Building2 size={32} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-white tracking-tight mb-2"><GlowText>Nebula OS</GlowText></h1>
                        <p className="text-gray-400 text-sm">Next-Gen Library Management System</p>
                    </div>
                </div>

                <Card className="backdrop-blur-3xl bg-[#0f111a]/70 border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Access</label>
                            <input
                                type="email"
                                placeholder="admin@nebula.com"
                                className="w-full bg-[#050508]/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-700 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 focus:outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Secure Key</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full bg-[#050508]/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-700 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 focus:outline-none transition-all"
                            />
                        </div>
                        <Button
                            variant="primary"
                            className="w-full py-3.5 mt-2 text-base shadow-[0_0_20px_rgba(124,58,237,0.4)]"
                            onClick={() => router.push("/")}
                        >
                            Initialize Session
                        </Button>
                    </div>
                    <div className="mt-6 text-center">
                        <a href="#" className="text-xs text-gray-500 hover:text-cyan-400 transition-colors">Recover Access Key?</a>
                    </div>
                </Card>
            </div>
        </div>
    );
}
