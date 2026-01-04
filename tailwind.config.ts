import type { Config } from "tailwindcss"

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
        },
    },
    plugins: [],
}

export default config
