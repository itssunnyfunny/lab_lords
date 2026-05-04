import { NextRequest, NextResponse } from "next/server";
import { StudentService } from "@/services/student.service";
import { getSessionUser } from "@/lib/auth";
import { StudentStatus } from "@prisma/client";
import { DueResolution } from "@/types";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Something went wrong";
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { branchId } = await params;
        const body = await req.json();

        if (!body.name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Normalise shiftIds: accept array or singular (backward compat)
        const shiftIds: string[] | undefined =
            Array.isArray(body.shiftIds) && body.shiftIds.length > 0
                ? body.shiftIds
                : body.shiftId
                    ? [body.shiftId]
                    : undefined;

        const student = await StudentService.createStudent(user.id, branchId, {
            name: body.name,
            phone: body.phone,
            shiftIds,
            seatId: body.seatId,
            monthlyFee: body.monthlyFee !== undefined && body.monthlyFee !== null ? Number(body.monthlyFee) : undefined,
            admissionFee: body.admissionFee !== undefined && body.admissionFee !== null ? Number(body.admissionFee) : undefined,
            feeLinkedShiftId: typeof body.feeLinkedShiftId === "string" ? body.feeLinkedShiftId : null,
            feeLinkedMultiShiftId: typeof body.feeLinkedMultiShiftId === "string" ? body.feeLinkedMultiShiftId : null,
        });

        return NextResponse.json(student, { status: 201 });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized")) return NextResponse.json({ error: message }, { status: 403 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}


export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { branchId } = await params;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") as StudentStatus | undefined;
        const shiftId = searchParams.get("shiftId") || undefined;

        const students = await StudentService.getStudentsByBranch(user.id, branchId, { status, shiftId });
        return NextResponse.json(students);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized")) return NextResponse.json({ error: message }, { status: 403 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();

        if (!body.id) {
            return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
        }

        // ── Path A: edit profile (name / phone)
        if (
            body.name !== undefined ||
            body.phone !== undefined ||
            body.monthlyFee !== undefined ||
            body.feeLinkedShiftId !== undefined ||
            body.feeLinkedMultiShiftId !== undefined
        ) {
            if (body.name !== undefined && typeof body.name === "string" && body.name.trim().length === 0) {
                return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
            }

            const updated = await StudentService.updateStudentProfile(user.id, body.id, {
                ...(body.name !== undefined ? { name: body.name } : {}),
                ...(body.phone !== undefined ? { phone: body.phone } : {}),
                ...(body.monthlyFee !== undefined && body.monthlyFee !== null ? { monthlyFee: Number(body.monthlyFee) } : {}),
                ...(body.feeLinkedShiftId !== undefined
                    ? { feeLinkedShiftId: typeof body.feeLinkedShiftId === "string" ? body.feeLinkedShiftId : null }
                    : {}),
                ...(body.feeLinkedMultiShiftId !== undefined
                    ? { feeLinkedMultiShiftId: typeof body.feeLinkedMultiShiftId === "string" ? body.feeLinkedMultiShiftId : null }
                    : {}),
            });

            return NextResponse.json(updated);
        }

        // ── Path B: change status
        if (!body.status) {
            return NextResponse.json(
                { error: "Provide profile/fee fields to edit, or status to change status" },
                { status: 400 }
            );
        }

        if (!Object.values(StudentStatus).includes(body.status)) {
            return NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }

        const student = await StudentService.updateStudentStatus(
            user.id,
            body.id,
            body.status as StudentStatus,
            (body.dueResolution ?? "KEEP") as DueResolution
        );
        return NextResponse.json(student);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized")) return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
