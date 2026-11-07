import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSidebar } from "@/components/account/AccountSidebar";
import type { WorkspaceDirectory } from "@/types";
const mocks=vi.hoisted(()=>({query:new URLSearchParams(),path:"/account/preferences"}));
vi.mock("next/navigation",()=>({usePathname:()=>mocks.path,useSearchParams:()=>mocks.query}));
vi.mock("@clerk/nextjs",()=>({SignOutButton:({children}:{children:React.ReactNode})=>children}));
vi.mock("@/hooks/useWorkspaceReturnHref",()=>({useWorkspaceReturnHref:()=>"/branch/old"}));
const directory={organizations:[{id:"old-org",name:"Previous",role:"OWNER",href:"/org/old-org",branches:[{id:"old",name:"Previous branch",organizationId:"old-org",organizationName:"Previous",role:"OWNER",permissions:{},entitlements:[],href:"/branch/old"}]},{id:"selected",name:"Selected",role:"OWNER",href:"/org/selected",branches:[]}],staffBranches:[],defaultHref:"/org/old-org"} satisfies WorkspaceDirectory;
beforeEach(()=>{mocks.query=new URLSearchParams();});
describe("Account sidebar scope",()=>{
 it("prefers the explicit organization over the previous branch",()=>{mocks.query=new URLSearchParams({organizationId:"selected",returnTo:"/branch/old"});const html=renderToStaticMarkup(<AccountSidebar directory={directory}/>);expect(html).toContain("/account/billing?organizationId=selected");expect(html).not.toContain("branchId=old");});
 it("keeps a staff branch return while the same user also owns an organization",()=>{
  mocks.query=new URLSearchParams({returnTo:"/branch/staff-branch/students"});
  const staffBranch={...directory.organizations[0].branches[0],id:"staff-branch",role:"STAFF" as const,href:"/branch/staff-branch"};
  const html=renderToStaticMarkup(<AccountSidebar directory={{...directory,staffBranches:[staffBranch]}}/>);
  expect(html).toContain('/account/preferences?returnTo=%2Fbranch%2Fstaff-branch%2Fstudents"');
  expect(html).toContain('/account/billing?organizationId=old-org&amp;returnTo=%2Forg%2Fold-org');
 });
 it("hides Billing for staff while retaining profile and preferences",()=>{const html=renderToStaticMarkup(<AccountSidebar directory={{...directory,organizations:[],staffBranches:[]}}/>);expect(html).not.toContain("/account/billing");expect(html).toContain("Profile &amp; security");expect(html).toContain("Preferences");});
});
