import { NextRequest, NextResponse } from "next/server";
import { StudentService } from "@/services/student.service";
import { getSessionUser } from "@/lib/auth";
import { StudentStatus } from "@prisma/client";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { branchId } = await params;
        const body = await req.json();

        if (!body.name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const student = await StudentService.createStudent(user.id, branchId, {
            name: body.name,
            phone: body.phone,
            shiftId: body.shiftId,
            seatId: body.seatId,
            monthlyFee: body.monthlyFee ? Number(body.monthlyFee) : undefined,
            admissionFee: body.admissionFee ? Number(body.admissionFee) : undefined,
        });

        return NextResponse.json(student, { status: 201 });
    } catch (error: any) {
        if (error.message.includes("Unauthorized")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { branchId } = await params;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") as StudentStatus | undefined;
        const shiftId = searchParams.get("shiftId") || undefined;

        const students = await StudentService.getStudentsByBranch(user.id, branchId, {
            status,
            shiftId,
        });

        return NextResponse.json(students);
    } catch (error: any) {
        if (error.message.includes("Unauthorized")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { branchId } = await params;
        const body = await req.json();

        if (!body.id || !body.status) {
            return NextResponse.json(
                { error: "Student ID and Status are required" },
                { status: 400 }
            );
        }

        // Validate status enum
        if (!Object.values(StudentStatus).includes(body.status)) {
            return NextResponse.json(
                { error: "Invalid status" },
                { status: 400 }
            );
        }

        const student = await StudentService.updateStudentStatus(
            user.id,
            body.id,
            body.status as StudentStatus
        );

        return NextResponse.json(student);
    } catch (error: any) {
        if (error.message.includes("Unauthorized")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
