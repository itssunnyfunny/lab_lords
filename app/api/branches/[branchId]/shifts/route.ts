import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ShiftService } from "@/services/shift.service";

// Helper to get user ID
async function getUserId() {
    const user = await getSessionUser();
    if (!user?.id) return null;
    return user.id;
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await context.params;

    try {
        const shifts = await ShiftService.listShifts(userId, branchId);
        return NextResponse.json(shifts);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: getErrorMessage(error, "Failed to fetch shifts") },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await context.params;

    try {
        const body = await request.json();
        const shift = await ShiftService.createShift(userId, branchId, body);
        return NextResponse.json(shift);
    } catch (error: unknown) {
        return NextResponse.json(
            { error: getErrorMessage(error, "Failed to create shift") },
            { status: 400 }
        );
    }
}
