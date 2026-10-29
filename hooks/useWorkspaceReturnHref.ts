"use client";
import { useEffect, useState } from "react";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { workspaces } from "@/lib/api/workspaces";
import { workspaceReturnPath } from "@/lib/contextualNavigation";
import { authorizedWorkspaceReturn } from "@/lib/basicNavigation";
export function useWorkspaceReturnHref(pathname: string | null) {
    const { ownerKey } = useUserPreferences();
    const [destination,setDestination] = useState<{owner:string|null;href:string}|null>(null);
    useEffect(()=>{
        let cancelled=false;
        const key="lab-lords:account-return:"+ownerKey, current=workspaceReturnPath(pathname);
        if(current) {try{sessionStorage.setItem(key,current);}catch{} return;}
        if(pathname!=="/account")return;
        async function resolve() {
            let requested=workspaceReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
            try{requested??=workspaceReturnPath(sessionStorage.getItem(key));}catch{}
            try {
                const directory=await workspaces.getDirectory();
                const href=authorizedWorkspaceReturn(requested,directory);
                if(!cancelled)setDestination({owner:ownerKey,href});
            } catch { if(!cancelled)setDestination({owner:ownerKey,href:"/app"}); }
        }
        void resolve();return()=>{cancelled=true;};
    },[ownerKey,pathname]);
    return destination?.owner===ownerKey?destination.href:null;
}
