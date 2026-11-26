import { NextResponse } from "next/server";
import { BillingDeadlineService } from "@/services/billingDeadline.service";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { errors, ...counts } = await BillingDeadlineService.run();
    return NextResponse.json({ ok: errors.length === 0, ...counts, failed: errors.length }, {
      status: errors.length ? 503 : 200,
    });
  } catch {
    return NextResponse.json({ error: "Branch billing reconciliation failed" }, { status: 500 });
  }
}
