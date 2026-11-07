"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { workspaces } from "@/lib/api/workspaces";
import { workspaceReturnPath } from "@/lib/contextualNavigation";
import { accountWorkspaceDestination } from "@/lib/accountNavigation";
export function useWorkspaceReturnHref(pathname: string | null) {
    const { ownerKey } = useUserPreferences();
    const search = useSearchParams().toString();
    const route = `${pathname}?${search}`;
    const [destination,setDestination] = useState<{owner:string|null;route:string;href:string}|null>(null);
    useEffect(()=>{
        let cancelled=false;
        const key="lab-lords:account-return:"+ownerKey, current=workspaceReturnPath(pathname);
        if(current) {try{sessionStorage.setItem(key,current);}catch{} return;}
        if(pathname!=="/account" && !pathname?.startsWith("/account/"))return;
        async function resolve() {
            let remembered: string | null = null;
            try{remembered=workspaceReturnPath(sessionStorage.getItem(key));}catch{}
            try {
                const directory=await workspaces.getDirectory();
                const href=accountWorkspaceDestination(pathname!,new URLSearchParams(search),remembered,directory);
                if(!cancelled)setDestination({owner:ownerKey,route,href});
            } catch { if(!cancelled)setDestination({owner:ownerKey,route,href:"/app"}); }
        }
        void resolve();return()=>{cancelled=true;};
    },[ownerKey,pathname,search,route]);
    return destination?.owner===ownerKey && destination.route===route?destination.href:null;
}
