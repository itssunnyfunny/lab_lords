"use client";

import React from "react";

export const AmbientBackground = () => (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#050508]">
        {/* Main central glow */}
        <div className="absolute top-[-10%] left-[20%] w-[40vw] h-[40vw] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
        {/* Secondary cyan glow */}
        <div className="absolute bottom-[-10%] right-[-10%] w-[35vw] h-[35vw] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen" />
        {/* Subtle noise texture for grain effect */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay" />
    </div>
);
