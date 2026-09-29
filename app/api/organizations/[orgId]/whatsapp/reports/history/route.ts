import { handleWhatsAppReportHistoryGet } from "@/lib/whatsappReportRoute";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await context.params;
  return handleWhatsAppReportHistoryGet(request, { scope: "ORGANIZATION", organizationId: orgId });
}
