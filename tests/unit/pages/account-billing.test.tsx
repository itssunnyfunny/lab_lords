import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import BillingPage from "@/app/account/billing/page";
import ProcessingPage from "@/app/account/billing/[orgId]/processing/[changeId]/page";
const mocks = vi.hoisted(() => ({ session: vi.fn(), directory: vi.fn(), owner: vi.fn() }));
vi.mock("@/lib/auth", () => ({getSessionUser:mocks.session}));
vi.mock("@/services/user.service", () => ({UserService:{getWorkspaceDirectory:mocks.directory}}));
vi.mock("@/services/organization.service", () => ({OrganizationService:{isOwner:mocks.owner}}));
vi.mock("next/navigation", () => ({notFound:()=>{throw new Error("NOT_FOUND")},redirect:(path:string)=>{throw new Error("REDIRECT:"+path)}}));
vi.mock("@/components/account/AccountBilling", () => ({AccountBilling:()=>null}));
vi.mock("@/components/billing/BillingProcessingContent", () => ({default:()=>null}));
const orgs = [{id:"one",branches:[{id:"a"}]},{id:"two",branches:[{id:"b"}]}];
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({id:"user"});mocks.directory.mockResolvedValue({organizations:orgs,staffBranches:[]});mocks.owner.mockResolvedValue(true);});
const open = (searchParams:{organizationId?:string;branchId?:string}) => BillingPage({searchParams:Promise.resolve(searchParams)});
describe("owner-only Account billing",()=>{
  it("selects only an owned organization and its branch",async()=>{
    const tree = await open({organizationId:"two",branchId:"b"});
    const content = tree.props.children as ReactElement<{organizationId:string;branchId:string}>;
    expect(content.props.organizationId).toBe("two");expect(content.props.branchId).toBe("b");
    expect(mocks.directory).toHaveBeenCalledWith("user");
  });
  it("resolves a branch-only link from the authorized directory",async()=>{
    const tree=await open({branchId:"b"});expect(tree.props.children.props.organizationId).toBe("two");
  });
  it.each([{organizationId:"foreign"},{organizationId:"missing"},{organizationId:"one",branchId:"b"},{branchId:"foreign"}])("returns the same generic result for invalid context %j",async context=>{await expect(open(context)).rejects.toThrow("NOT_FOUND");});
  it("does not grant a staff member billing access from branch membership",async()=>{
    mocks.directory.mockResolvedValue({organizations:[],staffBranches:[{id:"a",organizationId:"one"}]});
    await expect(open({organizationId:"one",branchId:"a"})).rejects.toThrow("NOT_FOUND");
  });
  it("redirects anonymous users before reading directory data",async()=>{mocks.session.mockResolvedValue(null);await expect(open({})).rejects.toThrow("REDIRECT:/sign-in");expect(mocks.directory).not.toHaveBeenCalled();});
  it("independently authorizes the processing route",async()=>{
    const params=Promise.resolve({orgId:"one",changeId:"change"});mocks.owner.mockResolvedValue(false);
    await expect(ProcessingPage({params})).rejects.toThrow("NOT_FOUND");expect(mocks.owner).toHaveBeenCalledWith("one","user");
    mocks.owner.mockResolvedValue(true);expect((await ProcessingPage({params})).props.orgId).toBe("one");
  });
});
