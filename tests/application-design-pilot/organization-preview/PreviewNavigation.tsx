import { useEffect } from "react";
import { notifyUserPreferencesChanged, useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { InterfaceLanguage } from "@/lib/i18n/language";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { WorkspaceSwitcher as OriginalSwitcher } from "../../../components/layout/WorkspaceSwitcher";
import { LanguageControls as OriginalLanguageControls } from "../../../components/settings/LanguageControls";
import { ORG, ORG_NAME, names, permittedBranches, switchDestination, type Branch } from "./model";
import { previewEnabled, useFixture } from "./store";
import { useCopy } from "./copy";
export { BranchWorkspaceControls } from "../../../components/layout/WorkspaceSwitcher";
export function BranchSelector() {
  const state=useFixture(), pathname=usePathname(), router=useRouter(), t=useCopy();
  const id=pathname.match(/^\/branch\/([^/]+)/)?.[1];
  const branches=permittedBranches(state);
  return <div className="op-selector">
    <label><span>{t("Branch")}</span><select aria-label={t("Switch branch")} value={id??""} onChange={event=>{const branch=branches.find(b=>b.id===event.target.value);if(branch)router.push(switchDestination(pathname,branch,state.role));}}>
      {!id && <option value="">{t("Choose a branch")}</option>}
      {branches.map(b=><option key={b.id} value={b.id}>{b.name} · {names[b.billed]}{b.access!==b.billed ? " · "+t(b.access==="NONE"?"Read-only":"Temporary access"):""}</option>)}
    </select></label>
    {state.role==="owner"&&<Link className="op-org-back" href={"/org/"+ORG}><ArrowLeft size={14}/>{t("Back to organization")}</Link>}
  </div>;
}
export function WorkspaceSwitcher(props: {className?:string}) {
  if(!previewEnabled())return <OriginalSwitcher {...props}/>;
  return <PreviewSwitcher/>;
}
function PreviewSwitcher(){ const path=usePathname(); return path.startsWith("/branch/")?<BranchSelector/>:<Link className="op-org-title" href={"/org/"+ORG}><Building2 size={19}/>{ORG_NAME}</Link>; }
export function PreviewLanguage(){
  const params=useSearchParams(),router=useRouter(),path=usePathname();
  const { ownerKey } = useUserPreferences();
  const locale = (params.get("lang") || "en") as InterfaceLanguage;
  useEffect(() => { notifyUserPreferencesChanged({ interfaceLanguage: locale }, ownerKey); }, [locale, ownerKey]);
  return <label className="op-language"><span className="sr-only">Interface language</span><select aria-label="Interface language" value={params.get("lang")??"en"} onChange={e=>{const next=new URLSearchParams(params);next.set("lang",e.target.value);router.replace(path+"?"+next);}}>
    <option value="en">English</option><option value="hi">हिंदी</option><option value="hinglish">Hinglish</option>
  </select></label>;
}
export function LanguageControls(props: {compact?:boolean}) { return previewEnabled()?<PreviewLanguage/>:<OriginalLanguageControls {...props}/>; }
export function PlanContext({branch}:{branch:Branch}){
  const state=useFixture(),t=useCopy(),path=usePathname();
  return <div className="op-plan-context" data-testid="branch-plan-context">
    <div><span>{t("Organization plan")}: <strong>{names[branch.billed]}</strong></span>
    <span>{t("Feature access")}: <strong>{branch.access==="NONE"?t("Read-only"):names[branch.access]}</strong>{branch.until&&" · "+t(branch.status==="trial"?"Trial until":"Temporary access until")+" "+branch.until}</span>
    {branch.scheduled&&<span>{t("Scheduled")}: {names[branch.scheduled.plan]} · {branch.scheduled.at}</span>}
    </div>
    {state.role==="owner"&&<Link href={billingHref(branch.id,path)}>{t("Manage plan")} →</Link>}
  </div>;
}
export function billingHref(id:string,returnTo="/branch/"+id){return "/org/"+ORG+"/billing?branchId="+encodeURIComponent(id)+"&returnTo="+encodeURIComponent(returnTo);}
