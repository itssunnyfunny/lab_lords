import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { RenewalInputError } from "@/services/renewals.service";

export function renewalsErrorResponse(error: unknown) {
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof RenewalInputError) {
        return NextResponse.json({ error: error instanceof RenewalInputError ? error.message : "Invalid renewal request" }, { status: 400 });
    }
    if (error instanceof BranchAccessNotFoundError || (error instanceof Error && error.message === "Student not found")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && /Unauthorized|permission|read.only|writ|archived|entitlement|subscription|activation/i.test(error.message)) {
        return NextResponse.json({ error: "This action is unavailable with your current access or branch status." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to load or save renewals. Please try again." }, { status: 500 });
}
