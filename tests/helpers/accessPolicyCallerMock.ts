import type { AccessPolicy as Policy } from "@/services/accessPolicy.service";
import type { StaffService as Staff } from "@/services/staff.service";
import type { EntitlementService as Entitlements } from "@/services/entitlement.service";

/** Caller unit tests retain their existing authorization/writability spies.
 * The real policy is exercised separately by access-policy integration tests. */
export function callerPolicyMock(Actual: typeof Policy, staff: typeof Staff, entitlements: typeof Entitlements) {
    return class extends Actual {
        static async authorizeCapability(...args: Parameters<typeof Policy.authorizeCapability>) {
            const [actor,branch,capability,client]=args;
            // Import caller tests model permissions/writability; the real Basic plan gate
            // is covered by basic-workspace and access-policy PostgreSQL tests.
            if(capability==="importStudents"||capability==="importView")return this.authorizeAction(actor,branch,"students",client,capability==="importStudents");
            return super.authorizeCapability(...args);
        }
        static async authorizeAction(...args: Parameters<typeof Policy.authorizeAction>) {
            const [actor, branch, action, client, write] = args;
            if (client) await staff.authorize(actor, branch, action, client);
            else await staff.authorize(actor, branch, action);
            if (write) {
                if (client) await entitlements.assertBranchWritable(branch, client);
                else await entitlements.assertBranchWritable(branch);
            }
            // No caller under this mock consumes or passes an issued context.
            return undefined as unknown as Awaited<ReturnType<typeof Policy.authorizeAction>>;
        }
    };
}
