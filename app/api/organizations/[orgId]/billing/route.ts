import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { BillingService } from "@/services/billing.service";
import { billingHttpStatus } from "@/lib/billingHttp";
import { billingIntentHeader, branchBillingIntentActions } from "@/lib/branchBillingIntents";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orgId } = await context.params;
    const branchId = new URL(_req.url).searchParams.get("branchId");
    const pendingKeys = _req.headers.get(billingIntentHeader)?.split(",", branchBillingIntentActions.length);
    const result = branchId ? await BillingService.listPlansForOrganization(user.id, orgId, branchId, pendingKeys)
      : await BillingService.listPlansForOrganization(user.id, orgId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: billingHttpStatus(error, 500) });
  }
}
