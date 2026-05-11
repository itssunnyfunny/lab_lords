"use client";

export const AmbientBackground = () => (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[color:var(--ui-ambient-bg)]">
        {/* Main central glow */}
        <div className="absolute left-[20%] top-[-10%] h-[40vw] w-[40vw] animate-pulse-slow rounded-full bg-[color:var(--ui-ambient-primary-glow)] blur-[120px] mix-blend-screen" />
        {/* Secondary cyan glow */}
        <div className="absolute bottom-[-10%] right-[-10%] h-[35vw] w-[35vw] rounded-full bg-[color:var(--ui-ambient-secondary-glow)] blur-[100px] mix-blend-screen" />
        {/* Subtle noise texture for grain effect */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay" />
    </div>
);
