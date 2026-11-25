import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors";
import { PaginationInputError } from "@/lib/cursorPagination";
import { BillingHistoryService } from "@/services/billingHistory.service";
import { BillingResourceNotFoundError } from "@/lib/billingErrors";

export async function billingHistoryResponse(request: Request, orgId: string, kind: "invoices" | "history") {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const params = new URL(request.url).searchParams;
        const branchId = params.get("branchId");
        return NextResponse.json(branchId
            ? await BillingHistoryService.page(user.id, orgId, kind, params.get("cursor"), branchId)
            : await BillingHistoryService.page(user.id, orgId, kind, params.get("cursor")));
    } catch (error) {
        if (error instanceof OrganizationAccessNotFoundError) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        if (error instanceof BillingResourceNotFoundError) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        if (error instanceof PaginationInputError) return NextResponse.json({ error: "Invalid history page" }, { status: 400 });
        return NextResponse.json({ error: "Unable to load billing history. Please try again." }, { status: 500 });
    }
}
