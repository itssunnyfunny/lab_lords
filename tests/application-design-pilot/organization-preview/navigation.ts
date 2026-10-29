import { isMutationPending, previewEnabled } from "./store";
let dirty = false;
export function markDraft() { if (previewEnabled()) dirty = true; }
export function clearDraft() { dirty = false; }
export function allowNavigation() {
  if (!previewEnabled()) return true;
  if (isMutationPending()) { window.alert("A sample payment is still being recorded for this branch. Wait for its result before switching."); return false; }
  if (dirty) {
    if (!window.confirm("You have unsaved changes in this branch. Discard them and leave?")) return false;
    dirty = false;
  }
  return true;
}
let installed = false;
export function installNavigationProtection(navigate: (href: string) => void) {
  if (installed) return; installed = true;
  document.addEventListener("click", event => {
    if (!previewEnabled() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin || url.searchParams.get("journey") === "org" || !/^\/(branch|org|account|app)(\/|$)/.test(url.pathname)) return;
    event.preventDefault(); navigate(url.pathname + url.search + url.hash);
  });
  let current = window.location.pathname + window.location.search;
  let index = window.history.state?.previewIndex ?? 0;
  window.history.replaceState({...window.history.state,previewIndex:index},"",window.location.href);
  window.addEventListener("pilot:navigation",()=>{current=window.location.pathname+window.location.search;index=window.history.state?.previewIndex??index;});
  let reverting = false;
  window.addEventListener("popstate",event=>{
    if (reverting) {reverting=false;event.stopImmediatePropagation();return;}
    const next=window.location.pathname+window.location.search;
    if (next!==current && !allowNavigation()) {
      event.stopImmediatePropagation();
      const nextIndex=event.state?.previewIndex;
      if (typeof nextIndex==="number" && nextIndex!==index) {reverting=true;window.history.go(index-nextIndex);}
      else window.history.replaceState({previewIndex:index},"",current);
      return;
    }
    current=next;index=event.state?.previewIndex??index;
  },true);
  window.addEventListener("beforeunload",event=>{if(previewEnabled()&&(dirty||isMutationPending())){event.preventDefault();event.returnValue="";}});
}
