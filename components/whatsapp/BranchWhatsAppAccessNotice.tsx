"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { SettingsPanel } from "@/components/settings/SettingsWorkspace";
import { appActionClassName } from "@/components/ui/AppButton";
import type { CapabilityDecision } from "@/types";

function observeSection(notify: () => void) {
    window.addEventListener("hashchange", notify);
    window.addEventListener("popstate", notify);
    return () => {
        window.removeEventListener("hashchange", notify);
        window.removeEventListener("popstate", notify);
    };
}

export function useWhatsAppSectionRequested() {
    return useSyncExternalStore(observeSection, () => window.location.hash === "#whatsapp", () => false);
}

export function BranchWhatsAppAccessNotice({ decision }: { decision: CapabilityDecision }) {
    const t = useTranslation();
    const directlyRequested = useWhatsAppSectionRequested();
    if (!directlyRequested || decision.allowed) return null;

    return <SettingsPanel id="whatsapp" title="WhatsApp" icon={MessageCircle}>
        <div className="space-y-3 px-5 py-4">
            <p role="status">{t.owned(decision.reason)}</p>
            {decision.recoveryHref && <Link className={appActionClassName("primary")} href={decision.recoveryHref}>{t.owned("Manage branch plan")}</Link>}
        </div>
    </SettingsPanel>;
}
