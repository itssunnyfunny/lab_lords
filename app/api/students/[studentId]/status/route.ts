import { NextRequest, NextResponse } from "next/server";
import { StudentService } from "@/services/student.service";
import { getSessionUser } from "@/lib/auth";
import { StudentStatus } from "@/app/generated/prisma/enums";
import { INVALID_RETURN_ORDER, INVALID_STUDENT_REJOINING_DATE, STUDENT_ALREADY_ACTIVE, validateStudentRejoiningDate } from "@/utils/studentRejoiningDate";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { studentId } = await params;
        const body = await req.json();

        if (!body || !Object.values(StudentStatus).includes(body.status)) {
            return NextResponse.json(
                { error: "Valid status is required" },
                { status: 400 }
            );
        }

        if (body.status === StudentStatus.ACTIVE) {
            const rejoinedOn = validateStudentRejoiningDate(body.rejoinedOn);
            if (!rejoinedOn) return NextResponse.json({ error: INVALID_STUDENT_REJOINING_DATE }, { status: 400 });
            return NextResponse.json(await StudentService.updateStudentStatus(user.id, studentId, StudentStatus.ACTIVE, "KEEP", rejoinedOn));
        }
        const student = await StudentService.updateStudentStatus(user.id, studentId, StudentStatus.INACTIVE);

        return NextResponse.json(student);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        if (message.includes("Unauthorized")) {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
        if (message === STUDENT_ALREADY_ACTIVE) return NextResponse.json({ error: message }, { status: 409 });
        if (message === INVALID_STUDENT_REJOINING_DATE || message === INVALID_RETURN_ORDER) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
