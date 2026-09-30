import { handleWhatsAppReportHistoryGet } from "@/lib/whatsappReportRoute";

export async function GET(
  request: Request,
  context: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await context.params;
  return handleWhatsAppReportHistoryGet(request, { scope: "BRANCH", branchId });
}
