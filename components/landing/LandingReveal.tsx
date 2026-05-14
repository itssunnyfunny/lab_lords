"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type LandingRevealVariant = "up" | "left" | "right" | "scale";

type LandingRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: LandingRevealVariant;
};

export function LandingReveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: LandingRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.16,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("landing-scroll-reveal", className)}
      data-landing-variant={variant}
      data-visible={isVisible ? "true" : "false"}
      style={{ "--landing-reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
