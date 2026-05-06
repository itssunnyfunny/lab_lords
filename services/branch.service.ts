import { prisma } from "@/lib/prisma";
import {
    assertKnownFields,
    assertPlainObject,
    optionalBoolean,
    optionalChoice,
    optionalNumber,
    optionalText,
    optionalTime,
} from "@/lib/settingsValidation";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";
import { CreateBranchDto, MESSAGE_LANGUAGES, REMINDER_TONES, UpdateBranchSettingsDto } from "@/types";
import { ShiftService } from "./shift.service";
import { StaffService } from "./staff.service";

interface CreateBranchForOrgParams {
    organizationId: string;
    userId: string;
    name: string;
    city?: string;
    defaultFee?: number;
    seatCount?: number;
    shifts?: {
        name: string;
        startTime: string | null;
        endTime: string | null;
        price: number;
    }[];
}

const BRANCH_SETTINGS_FIELDS = [
    "name",
    "city",
    "address",
    "contactPhone",
    "openingTime",
    "closingTime",
    "defaultFee",
    "defaultAdmissionFee",
    "defaultMessageLanguage",
    "reminderTone",
    "aiEnabled",
] as const;

export class BranchService {
    /**
     * Shared branch creation logic used by both onboarding and the
     * "Add New Branch" flow. Creates branch + seats + shifts + staff
     * in a single atomic transaction.
     */
    static async createBranchForOrg(params: CreateBranchForOrgParams) {
        const { organizationId, userId, name, city, defaultFee, seatCount, shifts } = params;
        const nameResult = validateRequiredText(name, "Branch name", 120);
        if (!nameResult.ok) throw new Error(nameResult.error);
        const cityResult = validateOptionalText(city, "City", FORM_LIMITS.cityMax);
        if (!cityResult.ok) throw new Error(cityResult.error);
        const defaultFeeResult = parseIntegerField(defaultFee, "Default monthly fee", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        if (!defaultFeeResult.ok) throw new Error(defaultFeeResult.error);
        const seatCountResult = parseIntegerField(seatCount, "Total seats", {
            min: 0,
            max: FORM_LIMITS.seatsMax,
        });
        if (!seatCountResult.ok) throw new Error(seatCountResult.error);
        const shiftsResult = shifts ? validateShiftDrafts(shifts, { allowEmpty: false }) : null;
        if (shiftsResult && !shiftsResult.ok) throw new Error(shiftsResult.error);

        return await prisma.$transaction(async (tx) => {
            // 1. Create the branch
            const branch = await tx.branch.create({
                data: {
                    name: nameResult.value,
                    city: cityResult.value,
                    defaultFee: defaultFeeResult.value ?? 0,
                    organizationId,
                },
            });

            // 2. Create shifts (custom or defaults)
            const shiftsToCreate = shiftsResult?.ok && shiftsResult.value.length > 0
                ? shiftsResult.value
                : [
                    { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0 },
                    { name: "Afternoon", startTime: "12:00", endTime: "17:00", price: 0 },
                    { name: "Evening", startTime: "17:00", endTime: "22:00", price: 0 },
                    { name: "Full Time", startTime: "06:00", endTime: "22:00", price: 0 },
                ];


            // ⚡ Bolt: Replaced O(n) individual shift creations with single bulk insert
            // Expected Impact: Reduces DB roundtrips from N to 1 during branch creation
            if (shiftsToCreate.length > 0) {
                await tx.shift.createMany({
                    data: shiftsToCreate.map(shift => ({
                        branchId: branch.id,
                        name: shift.name,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        price: shift.price,
                    }))
                });
            }

            // 3. Create seats
            // ⚡ Bolt: Replaced O(n) individual seat creations with single bulk insert
            // Expected Impact: Reduces DB roundtrips from N to 1 during branch creation
            if (seatCountResult.value && seatCountResult.value > 0) {
                const seatsData = Array.from({ length: seatCountResult.value }, (_, i) => ({
                    branchId: branch.id,
                    label: `${i + 1}`,
                }));
                await tx.seat.createMany({
                    data: seatsData,
                });
            }

            // 4. Add calling user as MANAGER on this branch
            await tx.staff.create({
                data: { userId, branchId: branch.id, role: "MANAGER" },
            });

            return branch;
        });
    }

    static async createBranch(data: CreateBranchDto) {
        const branch = await prisma.branch.create({
            data: {
                name: data.name,
                organizationId: data.organizationId,
            },
        });

        await ShiftService.ensureDefaultShifts(branch.id);

        return branch;
    }

    static async getBranchesByOrganizationId(organizationId: string) {
        return await prisma.branch.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: {
                        students: true,
                        seats: true,
                        shifts: true,
                    },
                },
            },
        });
    }

    static async getBranchById(id: string) {
        return await prisma.branch.findUnique({
            where: { id },
        });
    }

    static async getBranchDetails(userId: string, branchId: string) {
        await StaffService.authorize(userId, branchId, "students");
        const canViewStaff = await StaffService.authorize(userId, branchId, "manage_branch")
            .then(() => true)
            .catch(() => false);

        return prisma.branch.findUnique({
            where: { id: branchId },
            include: {
                organization: true,
                _count: {
                    select: {
                        seats: true,
                        students: { where: { status: "ACTIVE" } },
                        shifts: { where: { status: "ACTIVE" } },
                        payments: { where: { status: "DUE" } },
                        staff: true,
                    },
                },
                shifts: {
                    where: { status: "ACTIVE" },
                    select: {
                        id: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                        price: true,
                        isReserved: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
                staff: canViewStaff
                    ? {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    }
                    : false,
            },
        });
    }

    static parseSettingsPayload(body: unknown): UpdateBranchSettingsDto {
        assertPlainObject(body);
        assertKnownFields(body, BRANCH_SETTINGS_FIELDS);

        const settings: UpdateBranchSettingsDto = {};
        const name = optionalText(body.name, "Branch name", { required: true, max: 120 });
        const city = optionalText(body.city, "City", { max: 80 });
        const address = optionalText(body.address, "Address", { max: 240 });
        const contactPhone = optionalText(body.contactPhone, "Contact phone", { max: 40 });
        const openingTime = optionalTime(body.openingTime, "Opening time");
        const closingTime = optionalTime(body.closingTime, "Closing time");
        const defaultFee = optionalNumber(body.defaultFee, "Default monthly fee", { min: 0, max: 1000000 });
        const defaultAdmissionFee = optionalNumber(body.defaultAdmissionFee, "Default admission fee", { min: 0, max: 1000000 });
        const defaultMessageLanguage = optionalChoice(body.defaultMessageLanguage, "Default message language", MESSAGE_LANGUAGES);
        const reminderTone = optionalChoice(body.reminderTone, "Reminder tone", REMINDER_TONES);
        const aiEnabled = optionalBoolean(body.aiEnabled, "AI enabled");

        if (name != null) settings.name = name;
        if (city !== undefined) settings.city = city;
        if (address !== undefined) settings.address = address;
        if (contactPhone !== undefined) settings.contactPhone = contactPhone;
        if (openingTime !== undefined) settings.openingTime = openingTime;
        if (closingTime !== undefined) settings.closingTime = closingTime;
        if (defaultFee !== undefined) settings.defaultFee = defaultFee;
        if (defaultAdmissionFee !== undefined) settings.defaultAdmissionFee = defaultAdmissionFee;
        if (defaultMessageLanguage !== undefined) settings.defaultMessageLanguage = defaultMessageLanguage;
        if (reminderTone !== undefined) settings.reminderTone = reminderTone;
        if (aiEnabled !== undefined) settings.aiEnabled = aiEnabled;

        return settings;
    }

    static async updateSettings(userId: string, branchId: string, body: unknown) {
        await StaffService.authorize(userId, branchId, "manage_branch");
        const data = this.parseSettingsPayload(body);

        return prisma.branch.update({
            where: { id: branchId },
            data: {
                ...data,
                lastDataChange: new Date(),
            },
            include: {
                organization: true,
                _count: {
                    select: {
                        seats: true,
                        students: { where: { status: "ACTIVE" } },
                        shifts: { where: { status: "ACTIVE" } },
                        payments: { where: { status: "DUE" } },
                        staff: true,
                    },
                },
                shifts: {
                    where: { status: "ACTIVE" },
                    select: {
                        id: true,
                        name: true,
                        startTime: true,
                        endTime: true,
                        price: true,
                        isReserved: true,
                    },
                    orderBy: { createdAt: "asc" },
                },
                staff: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });
    }
}

