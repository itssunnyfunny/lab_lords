// Browser-fixture adapter only; production routes perform server authorization.
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import { PersonalSettings } from "@/components/account/PersonalSettings";
import { ProfileSecurity } from "@/components/account/ProfileSecurity";
import { AccountBilling } from "@/components/account/AccountBilling";
import BillingProcessingContent from "@/components/billing/BillingProcessingContent";
import type { WorkspaceDirectory } from "@/types";
export function AccountFixture() {
 const path=usePathname(),search=useSearchParams();
 const [directory,setDirectory]=useState<WorkspaceDirectory>({organizations:[],staffBranches:[],defaultHref:"/org"});
 useEffect(()=>{void fetch("/api/workspaces").then(r=>r.json()).then(setDirectory);},[]);
 const org=directory.organizations.find(item=>item.id===search.get("organizationId"))??directory.organizations[0];
 const processing=path.match(/^\/account\/billing\/([^/]+)\/processing\/([^/]+)/);
 return <AppShell designPilot sidebar={<AccountSidebar directory={directory}/>}>
 {processing ? <BillingProcessingContent orgId={processing[1]} changeId={processing[2]}/> : path === "/account/billing" ? org && <AccountBilling organizations={directory.organizations} organizationId={org.id} branchId={search.get("branchId")??undefined}/> : path === "/account/preferences" ? <PersonalSettings section="preferences"/> : <ProfileSecurity/>}
 </AppShell>;
}
