"use client";

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

export type PublicSupportDraft = { summary: string; details: string; contact: string };
export const emptySupportDraft: PublicSupportDraft = { summary: "", details: "", contact: "" };
const DraftContext = createContext<{ draft: PublicSupportDraft; setDraft: Dispatch<SetStateAction<PublicSupportDraft>> } | null>(null);

/** Lives in the persistent root layout. No browser storage, server state, cookies or URLs. */
export function PublicDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(emptySupportDraft);
  return <DraftContext.Provider value={{ draft, setDraft }}>{children}</DraftContext.Provider>;
}
export const usePublicSupportDraft = () => useContext(DraftContext);
