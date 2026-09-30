import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraftPublicationBusyError, DraftSourceChangedError } from "@/ai/generationLease";
const mocks = vi.hoisted(() => ({
  user: vi.fn(), staff: vi.fn(), entitlement: vi.fn(), writable: vi.fn(), report: vi.fn(), drafts: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionUser:mocks.user }));
vi.mock("@/lib/prisma", () => ({prisma:{
  branch:{findUnique:vi.fn(async()=>({id:"branch_1",name:"Main",organizationId:"org_1",organization:{ownerId:"owner"}}))},
  staff:{findUnique:mocks.staff},
}}));
vi.mock("@/services/entitlement.service", () => ({EntitlementService:{
  assertOrganizationEntitlement:mocks.entitlement,assertBranchWritable:mocks.writable,
}}));
vi.mock("@/ai/orchestrator/branchAI.orchestrator", () => ({runBranchAI:mocks.report}));
vi.mock("@/ai/messageDrafting/branchMessageDrafter", () => ({draftOverdueMessages:mocks.drafts}));
const params = () => ({params:Promise.resolve({branchId:"branch_1"})});
const request = (post=false) => new Request("http://test.local/api/ai/branch/branch_1/messages",post
  ? {method:"POST",headers:{"Content-Type":"application/json"},body:'{"studentIds":["student_1"]}'} : {}) as never;

describe("AI routes use the real shared access policy before complete payloads", () => {
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({id:"user_1"});
    mocks.staff.mockResolvedValue({id:"staff",role:"MANAGER",permissionOverrides:[]});
    mocks.entitlement.mockImplementation(async (_org,entitlement)=>{
      if(entitlement==="AI_ACCESS") throw new Error("Unauthorized: ai access requires an upgraded subscription plan");
    });
    mocks.writable.mockResolvedValue({canWrite:true});
    mocks.drafts.mockResolvedValue({items:[],meta:{}});
  });
  it("denies a Basic-plan report before cache or generation",async()=>{
    const route=await import("@/app/api/ai/branch/[branchId]/route");
    expect((await route.GET(request(),params())).status).toBe(403);
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("denies complete reports when payment visibility is explicitly denied",async()=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.staff.mockResolvedValue({id:"staff",role:"MANAGER",permissionOverrides:[{action:"VIEW_PAYMENTS",allowed:false}]});
    const route=await import("@/app/api/ai/branch/[branchId]/route");
    const response=await route.GET(request(),params());
    expect(response.status).toBe(403); expect(await response.json()).not.toHaveProperty("snapshot");
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("denies Basic-plan draft reads",async()=>{
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(403);
    expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it("denies report generation for a read-only branch",async()=>{
    mocks.entitlement.mockResolvedValue({}); mocks.writable.mockRejectedValue(new Error("Unauthorized: read-only"));
    const route=await import("@/app/api/ai/branch/[branchId]/route");
    expect((await route.GET(request(),params())).status).toBe(403); expect(mocks.report).not.toHaveBeenCalled();
  });
  it("allows cached drafts while read-only but denies regeneration",async()=>{
    mocks.entitlement.mockResolvedValue({}); mocks.writable.mockRejectedValue(new Error("Unauthorized: read-only"));
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(200);
    expect((await route.POST(request(true),params())).status).toBe(403);
    expect(mocks.drafts).toHaveBeenCalledTimes(1);
  });
  it("denies draft reads and regeneration when payment visibility is denied",async()=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.staff.mockResolvedValue({id:"staff",role:"MANAGER",permissionOverrides:[{action:"VIEW_PAYMENTS",allowed:false}]});
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(403);
    expect((await route.POST(request(true),params())).status).toBe(403);
    expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it.each([DraftSourceChangedError, DraftPublicationBusyError])("returns a generic conflict for interrupted draft publication: %s",async ErrorType=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.drafts.mockRejectedValue(new ErrorType());
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    const response=await route.POST(request(true),params());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({error:new ErrorType().message,code:new ErrorType().name});
  });
  it("does not expose unexpected draft errors to the client",async()=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.drafts.mockRejectedValue(new Error("internal database detail"));
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    const response=await route.GET(request(),params());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("internal database detail");
  });
});
