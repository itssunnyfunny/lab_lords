"use client";
import { useEffect, useRef } from "react";
import { WORKSPACE_NAVIGATION_REQUEST } from "@/lib/workspaceNavigationGuard";
/** Preserve Next's history state. Popstate cannot be cancelled, so restore its
 * prior index before Next consumes a declined Back/Forward navigation. */
export function useBasicNavigationGuard(allow: () => boolean, needsWarning: boolean, historyKey = "basicIndex") {
    const allowRef=useRef(allow);
    useEffect(()=>{allowRef.current=allow;});
    useEffect(()=>{
        const originalPush=history.pushState, originalReplace=history.replaceState;
        let index=typeof history.state?.[historyKey]==="number"?history.state[historyKey]:0;
        let current=location.href, restoring=false;
        originalReplace.call(history,{...history.state,[historyKey]:index},"",current);
        const push:History["pushState"]=function(state,title,url){index++;current=new URL(String(url??current),location.href).href;originalPush.call(history,{...state,[historyKey]:index},title,url);};
        const replace:History["replaceState"]=function(state,title,url){current=new URL(String(url??current),location.href).href;originalReplace.call(history,{...state,[historyKey]:index},title,url);};
        history.pushState=push;history.replaceState=replace;
        function pop(event:PopStateEvent) {
            if(restoring){restoring=false;event.stopImmediatePropagation();return;}
            const next=event.state?.[historyKey];
            if(!allowRef.current()){
                event.stopImmediatePropagation();
                if(typeof next==="number"&&next!==index){restoring=true;history.go(index-next);}
                else originalPush.call(history,{...history.state,[historyKey]:index},"",current);
                return;
            }
            if(typeof next==="number")index=next;
            current=location.href;
        }
        window.addEventListener("popstate",pop,true);
        return()=>{window.removeEventListener("popstate",pop,true);if(history.pushState===push)history.pushState=originalPush;if(history.replaceState===replace)history.replaceState=originalReplace;};
    },[historyKey]);
    useEffect(()=>{
        function unload(event:BeforeUnloadEvent){if(needsWarning){event.preventDefault();event.returnValue="";}}
        function programmatic(event:Event){if(!allowRef.current())event.preventDefault();}
        function link(event:MouseEvent){
            const anchor=(event.target as Element).closest?.("a[href]");
            if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||!(anchor instanceof HTMLAnchorElement)||anchor.target)return;
            if(anchor.hash&&anchor.pathname===location.pathname)return;
            if(!allowRef.current()){event.preventDefault();event.stopPropagation();}
        }
        window.addEventListener("beforeunload",unload);document.addEventListener("click",link,true);window.addEventListener(WORKSPACE_NAVIGATION_REQUEST,programmatic);
        return()=>{window.removeEventListener("beforeunload",unload);document.removeEventListener("click",link,true);window.removeEventListener(WORKSPACE_NAVIGATION_REQUEST,programmatic);};
    },[needsWarning]);
}
