import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(), staff: vi.fn(), entitlement: vi.fn(), writable: vi.fn(), report: vi.fn(), drafts: vi.fn(), branch: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionUser:mocks.user }));
vi.mock("@/lib/prisma", () => ({prisma:{
  branch:{findUnique:mocks.branch}, messageDraft:{findMany:mocks.drafts},
  staff:{findUnique:mocks.staff},
}}));
vi.mock("@/services/entitlement.service", () => ({EntitlementService:{
  assertOrganizationEntitlement:mocks.entitlement,assertBranchWritable:mocks.writable,
}}));
vi.mock("@/ai/orchestrator/branchAI.orchestrator", () => ({runBranchAI:mocks.report}));
const params = () => ({params:Promise.resolve({branchId:"branch_1"})});
const request = (post=false) => new Request("http://test.local/api/ai/branch/branch_1/messages",post
  ? {method:"POST",headers:{"Content-Type":"application/json"},body:'{"studentIds":["student_1"]}'} : {}) as never;

describe("AI routes use the real shared access policy before complete payloads", () => {
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.user.mockResolvedValue({id:"user_1"});
    mocks.branch.mockResolvedValue({id:"branch_1",name:"Main",organizationId:"org_1",organization:{ownerId:"owner"}});
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
  it("returns the retirement response for a Basic-plan branch member without reading drafts",async()=>{
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(410);
    expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it("denies report generation for a read-only branch",async()=>{
    mocks.entitlement.mockResolvedValue({}); mocks.writable.mockRejectedValue(new Error("Unauthorized: read-only"));
    const route=await import("@/app/api/ai/branch/[branchId]/route");
    expect((await route.GET(request(),params())).status).toBe(403); expect(mocks.report).not.toHaveBeenCalled();
  });
  it("retires both reads and generation even while the branch is read-only",async()=>{
    mocks.entitlement.mockResolvedValue({}); mocks.writable.mockRejectedValue(new Error("Unauthorized: read-only"));
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(410);
    expect((await route.POST(request(true),params())).status).toBe(410);
    expect(mocks.drafts).not.toHaveBeenCalled(); expect(mocks.writable).not.toHaveBeenCalled();
  });
  it("returns no draft data when payment visibility is denied",async()=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.staff.mockResolvedValue({id:"staff",role:"MANAGER",permissionOverrides:[{action:"VIEW_PAYMENTS",allowed:false}]});
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    expect((await route.GET(request(),params())).status).toBe(410);
    expect((await route.POST(request(true),params())).status).toBe(410);
    expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it.each([false, true])("does not disclose a foreign or missing branch through the retired endpoint (POST: %s)",async post=>{
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    mocks.staff.mockResolvedValue(null);
    const foreign=await (post ? route.POST : route.GET)(request(post),params());
    mocks.branch.mockResolvedValue(null);
    const missing=await (post ? route.POST : route.GET)(request(post),params());
    expect(foreign.status).toBe(404); expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json()); expect(mocks.drafts).not.toHaveBeenCalled();
  });
  it("does not expose unexpected draft errors to the client",async()=>{
    mocks.entitlement.mockResolvedValue({});
    mocks.branch.mockRejectedValue(new Error("internal database detail"));
    const route=await import("@/app/api/ai/branch/[branchId]/messages/route");
    const response=await route.GET(request(),params());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("internal database detail");
  });
});
