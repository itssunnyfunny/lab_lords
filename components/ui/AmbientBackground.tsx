"use client";

export const AmbientBackground = () => (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[color:var(--ui-ambient-bg)]">
        <div className="absolute left-[18%] top-[-18%] h-[42vw] w-[42vw] rounded-full bg-[color:var(--ui-ambient-primary-glow)] opacity-70 blur-[140px]" />
        <div className="absolute bottom-[-18%] right-[-12%] h-[38vw] w-[38vw] rounded-full bg-[color:var(--ui-ambient-secondary-glow)] opacity-70 blur-[120px]" />
    </div>
);
