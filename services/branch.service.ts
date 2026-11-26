import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { accountBillingHref } from "@/lib/accountNavigation";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { prisma } from "@/lib/prisma";
import {
    assertKnownFields,
    assertPlainObject,
    optionalBoolean,
    optionalChoice,
    optionalNumber,
    optionalText,
    optionalTime,
    requiredPhone,
} from "@/lib/settingsValidation";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateRequiredPhone,
    validateOptionalText,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";
import {
    MESSAGE_LANGUAGES,
    REMINDER_TONES,
    UpdateBranchSettingsDto,
    type StaffAction,
} from "@/types";
import { StaffService } from "./staff.service";
import {
    DEFAULT_PRIMARY_SHIFTS,
    ensureDefaultFullTimeMultiShift,
    includesDefaultPrimaryShiftNames,
} from "@/services/defaultShifts";
import { generateSeatLabelsForSeatCount, type SeatNumberingConfig } from "@/lib/seatNumbering";
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors";
import { isCheckoutBillingPlanId, type BillingPlanId } from "@/lib/billingPlans";
import { BillingResourceNotFoundError, BillingValidationError } from "@/lib/billingErrors";
import { IndependentBranchLifecycle } from "./independentBranchLifecycle.service";
import type {
    Branch,
    Prisma,
} from "@/app/generated/prisma/client";

interface CreateBranchForOrgParams {
    futurePlan?: BillingPlanId;
    organizationId: string;
    userId: string;
    name: string;
    contactPhone: string;
    city?: string;
    defaultFee?: number;
    seatCount?: number;
    seatNumbering?: SeatNumberingConfig;
    shifts?: {
        name: string;
        startTime: string | null;
        endTime: string | null;
        price: number;
    }[];
    idempotencyKey: string;
}

const BRANCH_DETAILS_SELECT = {
    id: true,
    organizationId: true,
    name: true,
    city: true,
    address: true,
    contactPhone: true,
    openingTime: true,
    closingTime: true,
    defaultFee: true,
    defaultAdmissionFee: true,
    defaultMessageLanguage: true,
    reminderTone: true,
    aiEnabled: true,
    createdAt: true,
    lastDataChange: true,
    aiLastCalledAt: true,
    aiStatus: true,
    billingStatus: true,
    billingActivatedAt: true,
    billingArchivedAt: true,
    organization: { select: { id: true, name: true } },
    _count: {
        select: {
            seats: true,
            students: { where: { status: "ACTIVE" } },
            shifts: { where: { status: "ACTIVE" } },
            payments: { where: { status: "DUE", amount: { gt: 0 } } },
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
        select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
    },
} satisfies Prisma.BranchSelect;

type BranchDetailsRecord = Prisma.BranchGetPayload<{ select: typeof BRANCH_DETAILS_SELECT }>;
type BranchDetailsCounts = Partial<Record<"seats" | "students" | "shifts" | "payments" | "staff", number>>;

export type BranchDetailsResponse = Pick<Branch, "id" | "organizationId" | "name"> &
    Partial<Pick<Branch,
        | "city"
        | "address"
        | "contactPhone"
        | "openingTime"
        | "closingTime"
        | "defaultFee"
        | "defaultAdmissionFee"
        | "defaultMessageLanguage"
        | "reminderTone"
        | "aiEnabled"
        | "createdAt"
        | "lastDataChange"
        | "aiLastCalledAt"
        | "aiStatus"
        | "billingStatus"
        | "billingActivatedAt"
        | "billingArchivedAt"
    >> & {
        organization: BranchDetailsRecord["organization"];
        _count?: BranchDetailsCounts;
        shifts?: BranchDetailsRecord["shifts"];
        staff?: BranchDetailsRecord["staff"];
    };

function projectBranchDetails(
    branch: BranchDetailsRecord,
    permissions: Record<StaffAction, boolean>,
    canViewStaff: boolean
): BranchDetailsResponse {
    const canManageBranch = permissions.manage_branch;
    const canViewStudents = permissions.students;
    const canViewPayments = permissions.view_payments;
    const canViewSeatData = permissions.seat_allocation || canManageBranch;
    const result: BranchDetailsResponse = {
        id: branch.id,
        organizationId: branch.organizationId,
        name: branch.name,
        organization: {
            id: branch.organization.id,
            name: branch.organization.name,
        },
    };

    if (canManageBranch) {
        Object.assign(result, {
            city: branch.city,
            address: branch.address,
            contactPhone: branch.contactPhone,
            openingTime: branch.openingTime,
            closingTime: branch.closingTime,
            defaultFee: branch.defaultFee,
            defaultAdmissionFee: branch.defaultAdmissionFee,
            defaultMessageLanguage: branch.defaultMessageLanguage,
            reminderTone: branch.reminderTone,
            aiEnabled: branch.aiEnabled,
            createdAt: branch.createdAt,
            lastDataChange: branch.lastDataChange,
            aiLastCalledAt: branch.aiLastCalledAt,
            aiStatus: branch.aiStatus,
            billingStatus: branch.billingStatus,
            billingActivatedAt: branch.billingActivatedAt,
            billingArchivedAt: branch.billingArchivedAt,
        });
    } else {
        if (canViewStudents) {
            result.defaultFee = branch.defaultFee;
            result.defaultAdmissionFee = branch.defaultAdmissionFee;
        }
        if (canViewPayments) {
            result.defaultMessageLanguage = branch.defaultMessageLanguage;
            result.reminderTone = branch.reminderTone;
        }
    }

    const counts: BranchDetailsCounts = {};
    if (canViewSeatData) {
        counts.seats = branch._count.seats;
        counts.shifts = branch._count.shifts;
    }
    if (canViewStudents) counts.students = branch._count.students;
    if (canViewPayments) counts.payments = branch._count.payments;
    if (canViewStaff) counts.staff = branch._count.staff;
    if (Object.keys(counts).length > 0) result._count = counts;

    if (canViewSeatData) result.shifts = branch.shifts;
    if (canViewStaff) result.staff = branch.staff;

    return result;
}

async function ownerBranchAgreement(userId: string, branchId: string) {
    const agreement = await prisma.branchBillingAgreement.findFirst({
        where: { branchId, branch: { organization: { ownerId: userId } } },
        select: { branchId: true, organizationId: true, branch: { select: { billingStatus: true } } },
    });
    if (!agreement) throw new BillingResourceNotFoundError("Branch not found");
    return agreement;
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
    /** Add a branch, its agreement, setup records and request receipt atomically. */
    static async createBranchForOrg(params: CreateBranchForOrgParams) {
        const { organizationId, userId, name, contactPhone, city, defaultFee, seatCount, shifts, seatNumbering } = params;
        const idempotencyKey = params.idempotencyKey.trim();
        if (!idempotencyKey) throw new Error("Idempotency-Key is required");
        const nameResult = validateRequiredText(name, "Branch name", 120);
        if (!nameResult.ok) throw new Error(nameResult.error);
        const contactPhoneResult = validateRequiredPhone(contactPhone, "Contact phone");
        if (!contactPhoneResult.ok) throw new Error(contactPhoneResult.error);
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
        const seatLabelsResult = generateSeatLabelsForSeatCount(seatCountResult.value, seatNumbering);
        if (!seatLabelsResult.ok) throw new Error(seatLabelsResult.error);
        const shiftsResult = shifts ? validateShiftDrafts(shifts, { allowEmpty: false }) : null;
        if (shiftsResult && !shiftsResult.ok) throw new Error(shiftsResult.error);
        const expectedBranch = {
            name: nameResult.value,
            contactPhone: contactPhoneResult.value,
            city: cityResult.value ?? null,
            defaultFee: defaultFeeResult.value ?? 0,
        };

        const futurePlan = params.futurePlan;
        return prisma.$transaction(async tx => {
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} AND "ownerId" = ${userId}
                  AND "billingModelVersion" = 'BRANCH_V3' FOR UPDATE
            `;
            if (!locked.length) throw new OrganizationAccessNotFoundError();
            if (!isCheckoutBillingPlanId(futurePlan)) {
                throw new BillingValidationError("Choose Basic, Standard or Pro for this branch.");
            }
            const previous = await tx.organizationBillingChange.findUnique({
                where: { idempotencyKey }, include: { branch: true },
            });
            if (previous) {
                const branch = previous.branch;
                if (!branch || previous.organizationId !== organizationId || branch.organizationId !== organizationId
                    || previous.agreementBranchId !== branch.id || previous.createdByUserId !== userId
                    || previous.organizationSubscriptionId || previous.fromQuantity !== 0 || previous.toQuantity !== 1
                    || !["LEGACY_TRANSITION", "TRIAL_SUBSCRIPTION_UPDATE"].includes(previous.type)) {
                    throw new BillingValidationError("Request key already used.");
                }
                if (previous.toPlan !== futurePlan) {
                    throw new BillingValidationError("This request was already used with a different branch plan.");
                }
                if (branch.name !== expectedBranch.name || branch.contactPhone !== expectedBranch.contactPhone
                    || branch.city !== expectedBranch.city || branch.defaultFee !== expectedBranch.defaultFee) {
                    throw new BillingValidationError("Idempotency key was already used with different branch details");
                }
                return { ...branch, billingChangeId: previous.id, action: "NONE" as const,
                    processingUrl: branch.billingStatus === "PENDING_ACTIVATION" ? accountBillingHref(organizationId, branch.id) : null };
            }

            const now = new Date();
            const trial = await tx.ownerTrialGrant.findFirst({ where: {
                organizationId, ownerId: userId, status: "ACTIVE", trialEndsAt: { gt: now },
            }, select: { id: true } });

            // 1. Create the branch
            const branch = await tx.branch.create({
                data: {
                    name: nameResult.value,
                    city: cityResult.value,
                    contactPhone: contactPhoneResult.value,
                    defaultFee: defaultFeeResult.value ?? 0,
                    organizationId,
                    billingStatus: trial ? "ACTIVE" : "PENDING_ACTIVATION",
                    billingActivatedAt: trial ? now : null,
                    billingAgreement: { create: { selectedPlan: futurePlan, billingMutationSequence: 1 } },
                },
            });

            // 2. Create shifts (custom or defaults)
            const shiftsToCreate = shiftsResult?.ok && shiftsResult.value.length > 0
                ? shiftsResult.value
                : DEFAULT_PRIMARY_SHIFTS;
            const shouldCreateDefaultFullTime = includesDefaultPrimaryShiftNames(shiftsToCreate);


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
                        isReserved: "isReserved" in shift ? shift.isReserved : false,
                    }))
                });
            }
            if (shouldCreateDefaultFullTime) {
                await ensureDefaultFullTimeMultiShift(tx, branch.id);
            }

            // 3. Create seats
            // ⚡ Bolt: Replaced O(n) individual seat creations with single bulk insert
            // Expected Impact: Reduces DB roundtrips from N to 1 during branch creation
            if (seatLabelsResult.value.length > 0) {
                const seatsData = seatLabelsResult.value.map(label => ({
                    branchId: branch.id,
                    label,
                }));
                await tx.seat.createMany({
                    data: seatsData,
                });
            }

            // 4. Add calling user as MANAGER on this branch
            await tx.staff.create({
                data: { userId, branchId: branch.id, role: "MANAGER" },
            });

            const [change] = await tx.organizationBillingChange.createManyAndReturn({
                data: {
                    organizationId, branchId: branch.id, agreementBranchId: branch.id,
                    idempotencyKey, createdByUserId: userId, sequence: 1,
                    type: trial ? "TRIAL_SUBSCRIPTION_UPDATE" : "LEGACY_TRANSITION",
                    status: "APPLIED", operationStatus: "APPLIED", fromQuantity: 0, toQuantity: 1,
                    toPlan: futurePlan, appliedAt: now, resolvedAt: now, effectiveAt: now,
                },
                select: { id: true },
                skipDuplicates: true,
            });
            if (!change) throw new BillingValidationError("Request key already used.");
            return { ...branch, billingChangeId: change.id, action: "NONE" as const,
                processingUrl: trial ? null : accountBillingHref(organizationId, branch.id) };
        });
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
        const access = await StaffService.getBranchAccess(userId, branchId);
        const canViewDetails =
            access.permissions.students ||
            access.permissions.seat_allocation ||
            access.permissions.manage_branch ||
            access.permissions.analytics ||
            access.permissions.view_payments;

        if (!canViewDetails) {
            throw new Error("Unauthorized: Branch details are not enabled for this staff member");
        }

        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: BRANCH_DETAILS_SELECT,
        });
        return branch ? projectBranchDetails(branch, access.permissions, getBranchCapabilityDecision(access, "staffView").allowed) : null;
    }

    static parseSettingsPayload(body: unknown): UpdateBranchSettingsDto {
        assertPlainObject(body);
        assertKnownFields(body, BRANCH_SETTINGS_FIELDS);

        const settings: UpdateBranchSettingsDto = {};
        const name = optionalText(body.name, "Branch name", { required: true, max: 120 });
        const city = optionalText(body.city, "City", { max: 80 });
        const address = optionalText(body.address, "Address", { max: 240 });
        const contactPhone = requiredPhone(body.contactPhone, "Contact phone");
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
        await AccessPolicy.authorizeAction(userId, branchId, "manage_branch", undefined, true);
        const data = this.parseSettingsPayload(body);

        await prisma.branch.update({
            where: { id: branchId },
            data: {
                ...data,
                lastDataChange: new Date(),
            },
            select: { id: true },
        });
        const updated = await this.getBranchDetails(userId, branchId);
        if (!updated) throw new Error("Branch not found after update");
        return updated;
    }

    static async retryPendingActivation(userId: string, branchId: string) {
        const scope = await ownerBranchAgreement(userId, branchId);
        if (scope.branch.billingStatus !== "PENDING_ACTIVATION") throw new BillingValidationError("Branch is not pending activation");
        return { action: "PROCESSING" as const, processingUrl: accountBillingHref(scope.organizationId, branchId) };
    }

    static async discardPendingActivation(userId: string, branchId: string) {
        const { organizationId } = await ownerBranchAgreement(userId, branchId);
        return IndependentBranchLifecycle.discard(userId, { organizationId, branchId });
    }

    static async reactivateArchivedBranch(userId: string, branchId: string, idempotencyKey: string) {
        const { organizationId } = await ownerBranchAgreement(userId, branchId);
        const key = idempotencyKey.trim();
        if (!key) throw new BillingValidationError("Idempotency-Key is required");
        return IndependentBranchLifecycle.reactivate(userId, { organizationId, branchId }, key);
    }

    static async scheduleBillingRemoval(userId: string, branchId: string, idempotencyKey: string) {
        const { organizationId } = await ownerBranchAgreement(userId, branchId);
        const key = idempotencyKey.trim();
        if (!key) throw new BillingValidationError("Idempotency-Key is required");
        return IndependentBranchLifecycle.schedule(userId, { organizationId, branchId }, key);
    }

    static async undoBillingRemoval(userId: string, branchId: string, expectedChangeId?: string) {
        const { organizationId } = await ownerBranchAgreement(userId, branchId);
        return IndependentBranchLifecycle.undo(userId, { organizationId, branchId }, expectedChangeId);
    }

    static async archiveDueBillingRemovals(now = new Date()) {
        const due = await prisma.organizationBillingChange.findMany({
            where: { agreementBranchId: { not: null }, type: "BRANCH_REMOVAL", status: "SCHEDULED", effectiveAt: { lte: now } },
            select: { id: true, organizationId: true, agreementBranchId: true },
        });
        let archived = 0;
        const errors: Array<{ organizationId: string; branchId: string; message: string }> = [];
        for (const candidate of due) {
            const { organizationId, agreementBranchId: branchId } = candidate;
            if (!branchId) continue;
            try {
                if (await IndependentBranchLifecycle.archive({ organizationId, branchId }, candidate.id, now)) archived++;
            } catch (error) {
                errors.push({ organizationId, branchId, message: error instanceof BillingValidationError
                    ? error.message : "Branch archival needs reconciliation." });
            }
        }
        return errors.length ? { archived, errors } : { archived };
    }
}
