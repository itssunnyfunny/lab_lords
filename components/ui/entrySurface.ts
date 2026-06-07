export const entryRootClass =
    "relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden overflow-y-auto bg-[color:var(--bg-app)] p-4 text-[color:var(--text-primary)] sm:p-6";

export const entryContentClass = "relative z-10 w-full";

export const entryPanelClass =
    "overflow-hidden rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] shadow-[var(--ui-form-dialog-shadow)] backdrop-blur-xl";

export const entryIconFrameClass =
    "inline-flex items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] text-[color:var(--ui-form-accent)]";

export const entryTitleClass = "text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-3xl";

export const entrySubtitleClass = "text-sm leading-6 text-[color:var(--text-secondary)]";

export const entryMutedTextClass = "text-[color:var(--text-secondary)]";

export const entrySubtleTextClass = "text-[color:var(--text-muted)]";

export const entryInlineInfoClass =
    "rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)]";

export const entryPrimaryLinkClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-5 text-sm font-semibold text-[color:var(--ui-button-primary-text)] shadow-[var(--ui-button-primary-shadow)] transition-colors hover:border-[color:var(--ui-button-primary-hover-border)] hover:bg-[color:var(--ui-button-primary-hover-bg)]";

export const entrySecondaryLinkClass =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-5 text-sm font-semibold text-[color:var(--ui-button-secondary-text)] shadow-[var(--ui-button-secondary-shadow)] transition-colors hover:border-[color:var(--ui-button-secondary-hover-border)] hover:bg-[color:var(--ui-button-secondary-hover-bg)]";

export const entryClerkAppearance = {
    variables: {
        colorPrimary: "#67e8f9",
        colorBackground: "#0f111a",
        colorInputBackground: "#171a24",
        colorInputText: "#f9fafb",
        colorText: "#f9fafb",
        colorTextSecondary: "#b6bdc9",
        colorDanger: "#fca5a5",
        colorNeutral: "#a8b0bd",
        borderRadius: "12px",
        fontFamily: "inherit",
    },
    elements: {
        rootBox: "w-full",
        cardBox: "w-full shadow-none",
        card:
            "w-full max-w-full gap-5 rounded-2xl border border-white/10 !bg-[#0f111a] px-5 py-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:px-7 sm:py-7",
        header: "gap-2 text-left",
        headerTitle: "!text-xl font-semibold tracking-tight !text-white",
        headerSubtitle: "text-sm leading-6 !text-slate-300",
        socialButtons: "gap-3",
        socialButtonsBlockButton:
            "min-h-11 rounded-xl !border-white/15 !bg-white/[0.04] text-sm font-semibold !text-slate-100 shadow-none transition-colors hover:!border-white/25 hover:!bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-cyan-300/40",
        socialButtonsBlockButtonText: "font-semibold !text-slate-100",
        dividerRow: "gap-3",
        dividerLine: "!bg-white/10",
        dividerText: "text-xs font-medium uppercase tracking-[0.14em] !text-slate-400",
        form: "gap-4",
        formFieldRow: "gap-4",
        formField: "gap-2",
        formFieldLabel: "text-sm font-medium !text-slate-200",
        formFieldInput:
            "min-h-11 rounded-xl !border-white/15 !bg-[#171a24] px-3.5 text-base !text-white shadow-none outline-none transition-colors placeholder:!text-slate-500 focus:!border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15 sm:text-sm",
        formFieldInputShowPasswordButton:
            "!text-slate-400 hover:!text-white focus-visible:ring-2 focus-visible:ring-cyan-300/40",
        formFieldAction:
            "font-medium !text-cyan-300 hover:!text-cyan-200",
        formFieldErrorText: "text-sm !text-red-300",
        formFieldSuccessText: "text-sm !text-emerald-300",
        formButtonPrimary:
            "min-h-11 rounded-xl !border-cyan-200/70 !bg-cyan-300 text-sm font-semibold !text-slate-950 shadow-none transition-colors hover:!bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-200/50",
        otpCodeFieldInput:
            "h-12 !border-white/15 !bg-[#171a24] !text-white focus:!border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15",
        identityPreview:
            "rounded-xl !border-white/10 !bg-white/[0.04]",
        identityPreviewText: "!text-white",
        identityPreviewEditButton:
            "!text-cyan-300 hover:!text-cyan-200",
        alternativeMethodsBlockButton:
            "min-h-11 rounded-xl !border-white/15 !bg-white/[0.04] !text-slate-100 hover:!border-white/25 hover:!bg-white/[0.07]",
        alert:
            "rounded-xl !border-red-400/30 !bg-red-400/10",
        alertText: "text-sm !text-red-200",
        footer: "gap-4",
        footerAction: "gap-1.5",
        footerActionText: "text-sm !text-slate-400",
        footerActionLink:
            "text-sm font-semibold !text-cyan-300 hover:!text-cyan-200",
        footerPages: "!text-slate-400",
        footerPageLink: "!text-slate-400 hover:!text-slate-200",
        backLink:
            "font-medium !text-cyan-300 hover:!text-cyan-200",
        formResendCodeLink:
            "font-medium !text-cyan-300 hover:!text-cyan-200",
    },
};
