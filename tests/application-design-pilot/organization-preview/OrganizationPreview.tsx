import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Building2, ArrowRight, ArrowLeft, Plus, CreditCard, Settings, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { AppLogo } from "@/components/brand/AppLogo";
import { AppPanel, PageShell } from "@/components/ui";
import { UserPreferencesBoundary } from "@/components/settings/UserPreferencesBoundary";
import { BranchWorkspaceShell } from "@/components/layout/BranchWorkspaceShell";
import { BasicPrototype } from "../basic-prototype/BasicPrototype";
import { PreviewDialog } from "../basic-prototype/Dialogs";
import { ORG, ORG_NAME, names, prices, createFixture, permittedBranches, resolveBranch, schedulePlan, applyScheduled, accountReturnDestination, type Branch, type Plan } from "./model";
import { useFixture, identityKey, updateFixture, resetFixture } from "./store";
import { billingHref, PlanContext, PreviewLanguage } from "./PreviewNavigation";
import { useCopy } from "./copy";
import { clearDraft, markDraft } from "./navigation";
import "./organization-preview.css";

const orgPath="/org/"+ORG;
function OrgNavigation(){
  const t=useCopy();return <aside className="op-org-sidebar" aria-label={t("Organization")}>
    <Link href={orgPath}><AppLogo markVariant="botanical"/></Link>
    <nav><Link href={orgPath}><Building2 size={19}/>{t("Your branches")}</Link><Link href={orgPath+"/billing"}><CreditCard size={19}/>{t("Billing")}</Link><Link href={orgPath+"/settings"}><Settings size={19}/>{t("Organization settings")}</Link></nav>
    <Link href="/account"><UserRound size={18}/>{t("Personal account")}</Link></aside>;
}
function PreviewNotice(){
  const params=useSearchParams(),router=useRouter(),path=usePathname(),t=useCopy();
  const change=(name:string,value:string)=>{const next=new URLSearchParams(params);next.set(name,value);next.set("journey","org");next.delete("plan");router.push((name==="role"&&value==="staff"?"/branch/pilot":path)+"?"+next);};
  return <div className="op-preview-notice"><span>{t("Synthetic preview · no real sign-in, database or payments")}</span>
    <details><summary>{t("Preview scenarios")}</summary><div>
      <label>{t("Role")}<select aria-label="Preview role" value={params.get("role")==="staff"?"staff":"owner"} onChange={e=>change("role",e.target.value)}><option value="owner">Owner</option><option value="staff">Restricted staff</option></select></label>
      <label>{t("Scenario")}<select aria-label="Preview scenario" value={params.get("case")??"basic"} onChange={e=>change("case",e.target.value)}>
      {["basic","standard","pro","future-mixed","single","empty","trial","grant","expired","pending","archived","scheduled","slow","loading","error"].map(x=><option key={x}>{x}</option>)}</select></label>
      <button onClick={()=>{if(window.confirm("Reset only this synthetic preview?")){clearDraft();resetFixture();}}}>{t("Reset sample data")}</button>
      <p>{t(params.get("case")==="future-mixed"?"Future developer scenario: independent branch plans are not part of this release.":"One organization plan applies to every branch. Prices are per active branch.")}</p>
    </div></details></div>;
}
function BranchStatus({branch}:{branch:Branch}){const t=useCopy();return <span className={"op-status op-status-"+branch.status}>{t(({active:"Active",trial:"Trial",grant:"Temporary access",expired:"Access expired",pending:"Activation pending",archived:"Archived"} as const)[branch.status])}</span>;}
function OrganizationHome(){
 const state=useFixture(),t=useCopy();const branches=permittedBranches(state);
 return <PageShell><div className="op-heading"><div><p className="op-eyebrow">{t("Organization")}</p><h1>{ORG_NAME}</h1><p>{t("Choose a branch. Its workspace and access travel with it.")}</p></div><Link className="op-button" href={orgPath+"/billing"}>{t("Billing and plans")}<ArrowRight size={17}/></Link></div>
 <p className="op-neutral-note">{t("This area is shared by your organization.")}</p>
 {!branches.length?<AppPanel><div className="op-empty"><Building2 size={36}/><h2>{t("No branches yet")}</h2><p>{t("Create a sample Basic branch to explore the journey.")}</p><button className="op-button op-primary" onClick={()=>updateFixture(s=>({...s,branches:[createFixture().branches[0]],revision:s.revision+1}))}><Plus size={17}/>{t("Add a sample branch")}</button></div></AppPanel>:
 <div className="op-branches">{branches.map(b=><AppPanel key={b.id}><article className="op-branch-card" data-testid={"branch-card-"+b.id}><div className="op-branch-icon"><Building2 size={24}/></div><BranchStatus branch={b}/><h2>{b.name}</h2><dl><div><dt>{t("Current billed plan")}</dt><dd>{names[b.billed]} · ₹{prices[b.billed]}/{t("month")}</dd></div><div><dt>{t("Feature access")}</dt><dd>{b.access==="NONE"?t("Read-only"):names[b.access]}{b.until&&<small>{t(b.status==="trial"?"Trial until":"Temporary access until")} {b.until}</small>}</dd></div>{b.scheduled&&<div><dt>{t("Scheduled")}</dt><dd>{names[b.scheduled.plan]} · {b.scheduled.at}</dd></div>}</dl><Link className="op-button op-primary" href={"/branch/"+b.id}>{t("Open branch")}<ArrowRight size={17}/></Link></article></AppPanel>)}</div>}
 </PageShell>;
}
function BillingPreview(){
 const state=useFixture(),params=useSearchParams(),router=useRouter(),t=useCopy();
 const future=state.scenario==="future-mixed";
 const id=future?(params.get("branchId")||""):(state.branches[0]?.id||""),branch=resolveBranch(state,id);
 const [selected,setSelected]=useState<Plan|null>(null),[confirming,setConfirming]=useState(false);
 const requestedReturn=params.get("returnTo");
 const returnTo=branch&&requestedReturn&&new RegExp("^/branch/"+branch.id+"(?:/[^?#]*)?$").test(requestedReturn)?requestedReturn:branch?"/branch/"+branch.id:orgPath;
 if(state.role!=="owner")return <Unavailable/>;
 return <PageShell><div className="op-heading"><div><p className="op-eyebrow">{ORG_NAME}</p><h1>{t("Billing and plans")}</h1><p>{t("Lab Lords subscriptions. Student fees stay inside each branch.")}</p></div><Link className="op-button" href={returnTo}><ArrowLeft size={16}/>{t(branch?"Return to workspace":"Back to organization")}</Link></div>
 <p className="op-simulation">{t(future?"Future developer scenario: independent branch plans are not part of this release.":"One organization plan applies to every branch. Prices are per active branch.")}</p>
 {future&&<label className="op-billing-selector">{t("Manage plan for")}<select aria-label={t("Manage plan for")} value={branch?.id??""} onChange={e=>router.push(billingHref(e.target.value))}><option value="">{t("Choose a branch")}</option>{state.branches.map(b=><option key={b.id} value={b.id}>{b.name} · {names[b.billed]}</option>)}</select></label>}
 {!branch?<AppPanel><p className="op-empty">{t(id?"Branch unavailable":"Choose a branch to see its subscription.")}</p></AppPanel>:<div key={branch.id}>
 <AppPanel><div className="op-billing-current"><h2>{future?branch.name:ORG_NAME}</h2><BranchStatus branch={branch}/><PlanContext branch={branch}/><p>{t("Current billed plan")}: <strong>{names[branch.billed]} · ₹{prices[branch.billed]}/{t("month")}</strong></p>
 {branch.selected&&<p>{t("Selected future plan")}: {names[branch.selected]} · {t("Not active yet")}</p>}
 {branch.scheduled&&<div className="op-scheduled"><strong>{branch.name}: {names[branch.scheduled.plan]} {t("from")} {branch.scheduled.at}</strong><p>{t("Current access stays in place until the effective date.")}</p><button className="op-button" onClick={()=>updateFixture(s=>({...s,branches:s.branches.map(b=>(!future||b.id===branch.id)?{...b,scheduled:undefined}:b)}))}>{t("Cancel scheduled change")}</button><button className="op-button" onClick={()=>updateFixture(s=>applyScheduled(s,branch.id))}>{t("Preview effective date")}</button></div>}
 </div></AppPanel>
 <div className="op-plans">{(["BASIC","STANDARD","PRO"] as Plan[]).map(plan=><AppPanel key={plan}><article className="op-plan-card"><small>{branch.name}</small><h2>{names[plan]}</h2><strong>₹{prices[plan]}<small>/{t("month")}</small></strong><p>{t(plan==="BASIC"?"Students, seats and student fees":plan==="STANDARD"?"Full workspace, staff, analytics and AI":"Standard features and WhatsApp")}</p><button className={"op-button "+(selected===plan?"op-primary":"")} disabled={plan===branch.billed&&!branch.scheduled} onClick={()=>{setSelected(plan);setConfirming(true);}}>{t(plan===branch.billed?"Current billed plan":"Choose plan")}</button></article></AppPanel>)}</div>
 {confirming&&selected&&<div className="bp-prototype"><PreviewDialog title={t("Confirm scheduled change")} onClose={()=>setConfirming(false)}><div className="bp-form-fields"><h3>{branch.name}</h3><p>{t("Current billed plan")}: {names[branch.billed]} · ₹{prices[branch.billed]}</p><p>{t("Selected future plan")}: <strong>{names[selected]} · ₹{prices[selected]}/{t("month")}</strong></p><p>{t("Effective date")}: 2026-11-28</p><p>{t(future?"Future-only: this branch changes independently.":"This plan change applies to every branch in the organization.")}</p><p>{t("Preview only. No authorization or charge will occur.")}</p></div><footer className="bp-dialog-footer"><button className="bp-button" onClick={()=>setConfirming(false)}>{t("Cancel")}</button><button className="bp-button bp-button-primary" onClick={()=>{updateFixture(s=>schedulePlan(s,branch.id,selected));setConfirming(false);setSelected(null);}}>{t("Confirm")}</button></footer></PreviewDialog></div>}
 </div>}</PageShell>;
}
function Unavailable(){const state=useFixture(),t=useCopy();return <div className="op-empty" role="alert"><h1>{t("Branch unavailable")}</h1><p>{t("This destination is not available to this preview account.")}</p><Link className="op-button" href={state.role==="owner"?orgPath:"/branch/pilot"}>{t(state.role==="owner"?"Back to organization":"Return to workspace")}</Link></div>;}
function AccountPreview(){const state=useFixture(),t=useCopy(),params=useSearchParams();const returnTo=accountReturnDestination(state,params.get("returnTo"));return <PageShell><div className="op-heading"><div><h1>{t("Personal account")}</h1><p>{t("Profile and language preferences")}</p></div></div><AppPanel><div className="op-account"><UserRound size={36}/><h2>{state.role==="owner"?"Amit Kumar":"Meera (staff)"}</h2><PreviewLanguage/><Link data-testid="account-return" className="op-button" href={returnTo}>{t("Return to workspace")}</Link></div></AppPanel></PageShell>;}
function LegacyDestination({href}:{href:string}) { const router=useRouter(); useEffect(()=>router.replace(href),[href,router]); return null; }
function OrgSettings(){const t=useCopy();return <PageShell><div className="op-heading"><div><h1>{t("Organization settings")}</h1><p>{ORG_NAME}</p></div></div><AppPanel><div className="op-account"><p>{t("Manage branches and subscriptions from the organization. Seats, shifts and student fees belong in each branch’s Library setup.")}</p><Link className="op-button" href={orgPath}>{t("Your branches")}</Link><Link className="op-button" href={orgPath+"/billing"}>{t("Billing and plans")}</Link><Link className="op-button" href="/account">{t("Personal account")}</Link></div></AppPanel></PageShell>;}
export function OrganizationPreview({fullSurface}:{fullSurface:ReactNode}){
 const state=useFixture(),path=usePathname(),params=useSearchParams(),t=useCopy();
 const branchId=path.match(/^\/branch\/([^/]+)/)?.[1],branch=branchId?resolveBranch(state,branchId):undefined;
 const key=identityKey()+":"+path;
 const [ready,setReady]=useState(""),[recovered,setRecovered]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setReady(key),state.scenario==="loading"?900:0);return()=>clearTimeout(timer);},[key,state.scenario]);
 const scope=path.match(/^\/org\/([^/]+)/)?.[1];
 const restricted=state.role==="staff"&&path.startsWith("/org");
 const routeArea=path.split("/")[3]||"";
 const denied=state.role==="staff"&&!!branch&&!["","students"].includes(routeArea);
 const generic=restricted||(scope&&scope!==ORG)||(branchId&&!branch)||denied;
 const loading=state.scenario==="loading"&&ready!==key;
 const failed=state.scenario==="error"&&!recovered;
 const content=generic?<Unavailable/>:loading||failed?<div className="op-empty" role={failed?"alert":"status"}><h1>{t(failed?"Workspaces unavailable":"Loading workspaces")}</h1>{failed&&<button className="op-button" onClick={()=>setRecovered(true)}>{t("Retry")}</button>}<Link className="op-button" href={state.role==="owner"?orgPath:"/branch/pilot"}>{t("Return to workspace")}</Link></div>:
 branch && ["account","subscription"].includes(routeArea)?<LegacyDestination href={routeArea==="account"?`/account?returnTo=${encodeURIComponent("/branch/"+branch.id)}`:billingHref(branch.id)}/>:branch?<div key={identityKey()+":"+branch.id+":"+branch.access} data-preview-branch={branch.id}>
 {branch.access==="BASIC"||branch.access==="NONE"?<BasicPrototype branch={branch}/>:<BranchWorkspaceShell branchId={branch.id}><PlanContext branch={branch}/>{fullSurface}</BranchWorkspaceShell>}
 </div>:path==="/account"?<AccountPreview/>:path.endsWith("/billing")?<BillingPreview key={params.get("branchId")||"none"}/>:path.endsWith("/settings")?<OrgSettings/>:<OrganizationHome/>;
 return <UserPreferencesBoundary><div className="op-journey" onInputCapture={e=>{const target=e.target as HTMLElement;if(target.closest("form")&&!target.closest(".op-preview-notice"))markDraft();}}><PreviewNotice/>
 {branch?<>{content}</>:<AppShell designPilot sidebar={path==="/account"?undefined:state.role==="owner"?<OrgNavigation/>:<nav className="op-org-sidebar"><Link href="/branch/pilot">{t("Return to workspace")}</Link></nav>}>{content}</AppShell>}
 </div></UserPreferencesBoundary>;
}
