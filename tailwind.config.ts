import type { Config } from "tailwindcss"
import scrollbar from "tailwind-scrollbar"

const config: Config = {
    darkMode: "class",
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                app: "var(--bg-app)",
                surface: "var(--bg-surface)",
                card: "var(--bg-card)",
                cardHover: "var(--bg-card-hover)",

                borderSubtle: "var(--border-subtle)",

                primary: "var(--accent-primary)",
                secondary: "var(--accent-secondary)",
                success: "var(--accent-success)",
                warning: "var(--accent-warning)",
                danger: "var(--accent-danger)",
                cyan: "var(--accent-cyan)",

                textPrimary: "var(--text-primary)",
                textSecondary: "var(--text-secondary)",
                textMuted: "var(--text-muted)",
            },
            borderRadius: {
                sm: "var(--radius-sm)",
                md: "var(--radius-md)",
                lg: "var(--radius-lg)",
            },
            boxShadow: {
                card: "var(--shadow-card)",
            },
            animation: {
                "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                shimmer: "shimmer 2s linear infinite",
            },
            keyframes: {
                shimmer: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
            },
        },
    },
    plugins: [scrollbar],
}

export default config
