import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { CollectionInputError } from "@/services/feeCollection.service";
export function feeCollectionError(error: unknown) {
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof CollectionInputError) {
        return NextResponse.json({ error: error instanceof CollectionInputError ? error.message : "Invalid collection request" }, { status: 400 });
    }
    if (error instanceof BranchAccessNotFoundError || (error instanceof Error && error.message === "Payment not found")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && /Unauthorized|permission|read.only|writ|archived|entitlement|subscription|activation/i.test(error.message)) {
        return NextResponse.json({ error: "This action is unavailable with your current access or branch status." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to confirm the result. Retry the same request to recover it safely." }, { status: 500 });
}
